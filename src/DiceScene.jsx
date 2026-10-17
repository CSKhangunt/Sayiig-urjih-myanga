import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const pipLayouts = {
  1: [[0, 0]],
  2: [[-0.22, 0.22], [0.22, -0.22]],
  3: [[-0.22, 0.22], [0, 0], [0.22, -0.22]],
  4: [[-0.22, -0.22], [-0.22, 0.22], [0.22, -0.22], [0.22, 0.22]],
  5: [[-0.22, -0.22], [-0.22, 0.22], [0, 0], [0.22, -0.22], [0.22, 0.22]],
  6: [[-0.22, -0.25], [-0.22, 0], [-0.22, 0.25], [0.22, -0.25], [0.22, 0], [0.22, 0.25]],
}

function addFacePips(die, face, value) {
  const layouts = pipLayouts[value]
  layouts.forEach(([a, b]) => {
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: '#17111f', roughness: 0.36, metalness: 0.15 }))
    if (face === 'front') pip.position.set(a, b, 0.505)
    if (face === 'back') pip.position.set(-a, b, -0.505)
    if (face === 'right') pip.position.set(0.505, b, -a)
    if (face === 'left') pip.position.set(-0.505, b, a)
    if (face === 'top') pip.position.set(a, 0.505, -b)
    if (face === 'bottom') pip.position.set(a, -0.505, b)
    die.add(pip)
  })
}

function createDie(value, accent) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#f7f4ef', roughness: 0.22, metalness: 0.08 }))
  group.add(body)
  ;['front', 'back', 'right', 'left', 'top', 'bottom'].forEach((face) => addFacePips(group, face, value))
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.62 }))
  group.add(edge)
  return group
}

function createCity(scene) {
  const city = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: '#72549a', emissive: '#20152f', emissiveIntensity: 0.55, roughness: 0.68, metalness: 0.1 })
  const gold = new THREE.MeshStandardMaterial({ color: '#f2c66d', emissive: '#7d4c2b', emissiveIntensity: 0.8 })
  ;[[-2.5, 0.16, -1.8], [-1.8, 0.28, -1.8], [1.8, 0.22, -1.8], [2.5, 0.38, -1.8], [-2.5, 0.24, 1.8], [-1.8, 0.15, 1.8], [1.8, 0.32, 1.8], [2.5, 0.2, 1.8]].forEach(([x, height, z], index) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.36, height, 0.32), index % 3 === 0 ? gold : material)
    block.position.set(x, height / 2 - 0.05, z)
    city.add(block)
  })
  scene.add(city)
}

export default function DiceScene({ values = [1, 1], rolling = false }) {
  const mountRef = useRef(null)
  const valuesRef = useRef(values)
  const rollingRef = useRef(rolling)

  useEffect(() => {
    valuesRef.current = values
    rollingRef.current = rolling
  }, [values, rolling])

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog('#140d20', 4, 10)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 3.4, 5.5)
    camera.lookAt(0, 0.25, 0)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight('#f3e7ff', '#26153a', 2.1))
    const keyLight = new THREE.DirectionalLight('#fff5de', 4.2)
    keyLight.position.set(-3, 5, 4)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight('#a875ff', 5, 8)
    rimLight.position.set(3, 1.8, -1)
    scene.add(rimLight)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshStandardMaterial({ color: '#211532', roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.92 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.46
    scene.add(floor)
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.13, 64), new THREE.MeshBasicMaterial({ color: '#a36cf0', transparent: true, opacity: 0.42 }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.445
    scene.add(ring)
    createCity(scene)

    const accent = '#c38aff'
    let dice = [createDie(valuesRef.current[0], accent), createDie(valuesRef.current[1], accent)]
    dice[0].position.set(-0.64, 0.28, 0.1)
    dice[1].position.set(0.64, 0.3, 0.06)
    scene.add(dice[0], dice[1])
    const startedAt = performance.now()
    let frame
    let previousRolling = false
    let rollStartedAt = 0
    let settleStartedAt = 0
    let previousValues = [...valuesRef.current]

    const resize = () => {
      const width = mount.clientWidth || 260
      const height = mount.clientHeight || 190
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    const animate = () => {
      const elapsed = (performance.now() - startedAt) / 1000
      const activeRolling = rollingRef.current
      if (activeRolling && !previousRolling) rollStartedAt = elapsed
      if (!activeRolling && previousRolling) settleStartedAt = elapsed
      previousRolling = activeRolling
      const rollTime = elapsed - rollStartedAt
      const settleTime = elapsed - settleStartedAt
      dice.forEach((die, index) => {
        die.position.y = 0.29 + Math.sin(elapsed * 2.2 + index) * 0.035
        if (activeRolling) {
          die.rotation.x += 0.19 + index * 0.025
          die.rotation.y += 0.25 + index * 0.02
          die.rotation.z += 0.13
          die.position.y += Math.min(0.55, Math.sin(Math.min(rollTime, 1.2) * Math.PI) * 0.65)
        } else if (settleTime < 0.34) {
          const easing = 1 - Math.pow(1 - Math.min(settleTime / 0.34, 1), 3)
          die.rotation.x += 0.018 * (1 - easing)
          die.rotation.y += 0.025 * (1 - easing)
        } else {
          die.rotation.z = Math.sin(elapsed * 0.7 + index) * 0.025
        }
      })
      if (previousValues[0] !== valuesRef.current[0] || previousValues[1] !== valuesRef.current[1]) {
        dice.forEach((die) => scene.remove(die))
        dice = [createDie(valuesRef.current[0], accent), createDie(valuesRef.current[1], accent)]
        dice[0].position.set(-0.64, 0.28, 0.1)
        dice[1].position.set(0.64, 0.3, 0.06)
        scene.add(dice[0], dice[1])
        previousValues = [...valuesRef.current]
      }
      ring.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.025)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
          else object.material.dispose()
        }
      })
    }
  }, [])

  return <div className="dice-scene" ref={mountRef} aria-label={rolling ? 'Шоо эргэлдэж байна' : 'Хоёр шоо'} />
}
