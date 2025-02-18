'use client'

import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import Threebox from 'threebox-plugin/src/Threebox';
import * as THREE from 'three';
import chroma from 'chroma-js';

import 'mapbox-gl/dist/mapbox-gl.css'

import stacking from '../../data/stacking.json';

/**
 * Finds point intersecting GeoJSON geometry side using line-line intersection calculation
 * @param {float[]} centerCoord Center of building
 * @param {float} percentCircle Value 0.0 to 1.0 representing percent of circle from 0 to 2*PI radians
 * @param {int} floorPlan Floorplan of building from JSON
 */
function findIntersection(centerCoord, percentCircle, floorPlan) {
    // Margin of error else won't detect intersection of PI/2 multiples
    const marginOfError = 1e-10;
    const radialCoord = [Math.cos(2*Math.PI*percentCircle)+centerCoord[0], Math.sin(2*Math.PI*percentCircle)+centerCoord[1]]

    for(const [i, currCoord] of stacking.coordinates[floorPlan].entries()) {
        const prevCoord = stacking.coordinates[floorPlan].slice(i-1)[0]

        const det12 = centerCoord[0]*radialCoord[1]-centerCoord[1]*radialCoord[0];
        const det34 = currCoord[0]*prevCoord[1]-currCoord[1]*prevCoord[0];
        const diffx12 = centerCoord[0]-radialCoord[0];
        const diffx34 = currCoord[0]-prevCoord[0];
        const diffy12 = centerCoord[1]-radialCoord[1];
        const diffy34 = currCoord[1]-prevCoord[1];
        const den = (diffx12*diffy34 - diffy12*diffx34);

        // If denominator is 0, parallel or coincident
        if(den===0) {
            continue;
        }

        const interPoint = [(det12*diffx34 - diffx12*det34)/den, (det12*diffy34 - diffy12*det34)/den]
        // On the basis that sum of absolute distances between endpoint and intersection
        // should be equal to distance between endpoints if intersecting
        if(Math.abs(interPoint[0]-currCoord[0])+Math.abs(interPoint[0]-prevCoord[0])<=Math.abs(currCoord[0]-prevCoord[0])+marginOfError &&
           Math.abs(interPoint[1]-currCoord[1])+Math.abs(interPoint[1]-prevCoord[1])<=Math.abs(currCoord[1]-prevCoord[1])+marginOfError &&
           Math.abs(interPoint[0]-centerCoord[0])+Math.abs(interPoint[0]-radialCoord[0])<=Math.abs(centerCoord[0]-radialCoord[0])+marginOfError &&
           Math.abs(interPoint[1]-centerCoord[1])+Math.abs(interPoint[1]-radialCoord[1])<=Math.abs(centerCoord[1]-radialCoord[1])+marginOfError) {
            return interPoint;
        }
    }
    return null;
}

export default function Home() {
    const mapRef = useRef();
    const mapContainerRef = useRef();

    const buildingFloorHeight = stacking.height/stacking.floors;
    const showInfo = (e) => {
        const floor = e.features[0].properties.floor;
        const vacancy = stacking.stackingplan[floor-1].reduce((a, e) => a-e[1], 1)*100;

        floorPopup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`
        <div class="min-w-52 text-black">
            <div class="font-bold">Floor ${floor}</div>
            <div class="text-lg">
                ${stacking.stackingplan[floor-1].map(e => '<div>'+e[0]+' - '+(e[1]*100).toFixed(2)+'%</div>').join('')}
                ${vacancy!==0 ? '<div>Vacancy - '+vacancy.toFixed(2)+'%</div>' : ''}
            </div>
        </div>
        `).addTo(mapRef.current);
    }

    useEffect(() => {
        var centerCoord = []
        stacking.coordinates.forEach((floorPlan) => {
            var maxCoord = [-Infinity, -Infinity];
            var minCoord = [Infinity, Infinity];
            floorPlan.forEach((e) => {
                if(maxCoord[0]<e[0]) {
                    maxCoord[0] = e[0];
                }
                else if(minCoord[0]>e[0]) {
                    minCoord[0] = e[0];
                }
                if(maxCoord[1]<e[1]) {
                    maxCoord[1] = e[1];
                }
                else if(minCoord[1]>e[1]) {
                    minCoord[1] = e[1];
                }
            });
            centerCoord.push([(maxCoord[0]+minCoord[0])/2, (maxCoord[1]+minCoord[1])/2]);
        });
    
        var intersections = [];
        for(var i=0;i<100;i++) {
            intersections.push({
                "type": "Feature",
                "geometry": {
                    "coordinates": findIntersection(centerCoord[0], i*0.01, 0),
                    "type": "Point"
                }
            });
        }
        for(var i=0;i<100;i++) {
            intersections.push({
                "type": "Feature",
                "geometry": {
                    "coordinates": findIntersection(centerCoord[1], i*0.01, 1),
                    "type": "Point"
                }
            });
        }
    
        var floorPopup = new mapboxgl.Popup();
        var jasons = [];
    
        [...Array(stacking.floors).keys()].forEach(e => {
            jasons.push({
                'type': 'Feature',
                'properties': {
                    'floor': e+1,
                    'height': (e+1)*buildingFloorHeight, // I think this is in meters
                    'base_height': e*buildingFloorHeight+0.5, // Removes bottom, doesn't move it up
                    'color': stacking.stackingplan[e].length ? chroma.average(stacking.stackingplan[e].map(tenant => stacking.tenants[tenant[0]].color)).hex() : '#ffffff'
                },
                'geometry': {
                    'coordinates': [
                        stacking.coordinates[stacking.coordinatefloors.findIndex(floor => e+1<=floor)]
                    ],
                    'type': 'Polygon'
                }
            });
        });

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
                    'features': jasons
                }
            });
            mapRef.current.addSource('centerpoint', {
                type: 'geojson',
                data: {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "coordinates": [
                                    centerCoord[0][0],
                                    centerCoord[0][1]
                                ],
                                "type": "Point"
                            }
                        }
                    ]
                }
            });
            mapRef.current.addSource('intersection', {
                type: 'geojson',
                data: {
                    "type": "FeatureCollection",
                    "features": intersections
                }
            });
            mapRef.current.addLayer({
                'id': 'stackingplan-layer',
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
                id: 'centerpoint-layer',
                type: 'circle',
                source: 'centerpoint',
                paint: {
                    'circle-radius': 5,
                    'circle-stroke-color': '#b70021',
                    'circle-stroke-width': 5,
                    'circle-color': '#ffffff',
                },
            });
            mapRef.current.addLayer({
                id: 'intersection-layer',
                type: 'circle',
                source: 'intersection',
                paint: {
                    'circle-radius': 5,
                    'circle-stroke-color': '#b70021',
                    'circle-stroke-width': 5,
                    'circle-color': '#ffffff',
                },
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

            mapRef.current.addLayer({
                id: '609-main',
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
                    const scale = 50;
                    const options = {
                        obj: '/ps5.glb',
                        type: 'glb',
                        scale: { x: scale, y: scale, z: scale },
                        units: 'meters',
                        rotation: { x: 90, y: 0, z: 0 },
                    };

                    var dl = new THREE.DirectionalLight(0xffffff);
                    dl.position.set(0, -70, 100).normalize();
                    window.tb.scene.add(dl);
                    var dl2 = new THREE.DirectionalLight(0xffffff);
                    dl2.position.set(0, 70, 100).normalize();
                    window.tb.scene.add(dl2);

                    window.tb.loadObj(options, (model) => {
                        model.setCoords([-95.36270621978426, 29.759467367489187]);
                        model.setRotation({ x: 0, y: 0, z: 235 });
                        window.tb.add(model);
                    });
                },
                render: () => {
                    window.tb.update();
                }
            });
        });
            
        mapRef.current.on('click', 'stackingplan-layer', (e) => showInfo(e));

        return () => mapRef.current.remove();
    }, []);

    return (
        <div className='overflow-hidden'>
            <div id='map-container' ref={mapContainerRef} className='w-screen h-screen'></div>
        </div>
    );
}
