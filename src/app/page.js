'use client'

import { useRef, useEffect } from "react";
import mapboxgl from 'mapbox-gl';
import Threebox from 'threebox-plugin/src/Threebox';
import * as THREE from 'three';

export default function Home() {
    const mapRef = useRef();
    const mapContainerRef = useRef();

    useEffect(() => {
        mapboxgl.accessToken = 'pk.eyJ1IjoiaWtzb21ldGhpbmdzb21ldGhpbmczODIzIiwiYSI6ImNseDk4d3c1MDJyYWkybXB2cXgzeGZqZ2kifQ.nFz0xuCOfn17Kj0bu2ahiw';
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-95.3656135755987, 29.76014807317625],
            zoom: 17,
            pitch: 60,
        });
        
        mapRef.current.on('style.load', () => {
            mapRef.current.addLayer({
                id: 'stacking-plan',
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

                    var geometry1 = new THREE.BoxGeometry(60, 60, 60);
                    var material1 = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(0xff0000),
                        side: THREE.DoubleSide,
                        clippingPlanes: [
                            new THREE.Plane(new THREE.Vector3(0, 0, 0), 5.1)
                        ],
                        clipIntersection: true
                    });

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

        return () => mapRef.current.remove();
    }, []);

    return (
        <div className="overflow-hidden">
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}
