'use client'

import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import Threebox from 'threebox-plugin/src/Threebox';
import * as THREE from 'three';

import 'mapbox-gl/dist/mapbox-gl.css'

import stacking from '../../data/stacking.json';

export default function Home() {
    const mapRef = useRef();
    const mapContainerRef = useRef();

    const buildingFloorHeight = stacking.height/stacking.floors;
    const randomColors = ['#00c7be', '#30b0c7', '#32ade6', '#007aff', '#5856d6']

    var floorPopup = new mapboxgl.Popup();
    
    function showInfo(e) {
        const floor = e.features[0].properties.floor;
        floorPopup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`
        <div class="w-52 text-black">
            <div class="font-bold">Floor ${floor}</div>
            <div class="text-lg">${stacking.stackingplan[floor-1].map(e => '<div>'+e+'</div>').join('')}</div>
        </div>
        `).addTo(mapRef.current);
    }

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-95.3656135755987, 29.76014807317625],
            zoom: 17,
            pitch: 60,
        });

        mapRef.current.on('style.load', () => {
            mapRef.current.addSource('stackingplan', {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': [...Array(stacking.floors).keys()].map(e => ({
                        'type': 'Feature',
                        'properties': {
                            'floor': e+1,
                            'height': (e+1)*buildingFloorHeight, // I think this is in meters
                            'base_height': e*buildingFloorHeight, // Removes bottom, doesn't move it up
                            'color': stacking.stackingplan[e].length ? stacking.tenants[stacking.stackingplan[e][0]].color : '#ffffff'
                        },
                        'geometry': {
                            'coordinates': [
                                stacking.coordinates[stacking.coordinatefloors.findIndex(floor => e+1<=floor)]
                            ],
                            'type': 'Polygon'
                        }
                    }))
                }
            });
            mapRef.current.addLayer({
                'id': 'stacking-plan',
                'type': 'fill-extrusion',
                'source': 'stackingplan',
                'paint': {
                    'fill-extrusion-color': ['get', 'color'],
                    'fill-extrusion-height': ['get', 'height'],
                    'fill-extrusion-base': ['get', 'base_height'],
                    'fill-extrusion-opacity': 1
                }
            });

            mapRef.current.addLayer({
                id: 'pennzoil-place',
                type: 'custom',
                renderingMode: '3d',
                paint: {
                    'fill-color': '#ff0000'
                },
                onAdd: () => {
                    window.tb = new Threebox(
                        mapRef.current,
                        mapRef.current.getCanvas().getContext('webgl'),
                        { defaultLights: true }
                    );
                    const scale = 20;
                    const options = {
                        obj: '/tower.glb',
                        type: 'glb',
                        scale: { x: scale, y: scale, z: scale },
                        units: 'meters',
                        rotation: { x: 90, y: 45, z: 0 },
                    };

                    var dl = new THREE.DirectionalLight(0xff0000);
                    dl.position.set(0, -70, 100).normalize();
                    window.tb.scene.add(dl);
                    var dl2 = new THREE.DirectionalLight(0xff0000);
                    dl2.position.set(0, 70, 100).normalize();
                    window.tb.scene.add(dl2);

                    window.tb.loadObj(options, (model) => {
                        model.setCoords([-95.36576714742297, 29.76046335699732]);
                        model.setRotation({ x: 0, y: 0, z: 235 });
                        window.tb.add(model);
                    });
                },
                render: () => {
                    window.tb.update();
                }
            });
        });
            
        mapRef.current.on('mouseenter', 'stacking-plan', (e) => showInfo(e));
        mapRef.current.on('mouseleave', 'stacking-plan', () => floorPopup.remove());

        return () => mapRef.current.remove();
    }, []);

    return (
        <div className='overflow-hidden'>
            <div id='map-container' ref={mapContainerRef} className='w-screen h-screen'></div>
        </div>
    );
}
