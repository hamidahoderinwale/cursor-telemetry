/**
 * Navigator 3D Renderer Module
 * Three.js-based 3D visualization for the semantic navigator
 */

/**
 * Render the navigator in 3D using Three.js
 */
function renderNavigator3D(container, nodes, links) {
  if (!window.navigatorState) {
    console.error('[NAVIGATOR-3D] navigatorState not available');
    return;
  }
  
  if (typeof THREE === 'undefined') {
    console.error('[NAVIGATOR-3D] Three.js not loaded');
    container.innerHTML = '<div class="error-wrapper">Three.js library not loaded. Please refresh the page.</div>';
    return;
  }
  
  const navigatorState = window.navigatorState;
  container.innerHTML = '';
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 700;
  
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a); // var(--color-bg)
  
  // Camera setup
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
  camera.position.set(0, 0, 500);
  
  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  
  // Controls - use OrbitControls if available
  let controls = null;
  // Try to use OrbitControls (may need to be loaded separately)
  if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 100;
    controls.maxDistance = 2000;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.autoRotate = false;
  } else {
    // Fallback: manual camera controls
    console.warn('[NAVIGATOR-3D] OrbitControls not available, using manual controls');
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    renderer.domElement.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        // Rotate camera around the scene
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });
    
    renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.01;
      camera.position.multiplyScalar(1 + delta);
    });
  }
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight1.position.set(1, 1, 1);
  scene.add(directionalLight1);
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);
  
  // Calculate z-axis depth based on file activity
  const calculateZDepth = (node) => {
    // Use multiple factors for z-depth:
    // 1. File changes (more changes = higher)
    // 2. Event count (more events = higher)
    // 3. File size (larger files = higher)
    const changes = node.changes || 0;
    const events = node.events?.length || 0;
    const size = node.size || 0;
    
    // Normalize and combine
    const activityScore = Math.log1p(changes) * 20 + 
                         Math.log1p(events) * 15 + 
                         Math.log1p(size / 1024) * 10;
    
    // Scale to reasonable z-range (-200 to 200)
    return Math.max(-200, Math.min(200, activityScore - 100));
  };
  
  // Normalize positions to fit in 3D space
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min(400 / rangeX, 400 / rangeY);
  
  // Create node geometries and materials
  const nodeMeshes = [];
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);
  
  const getFileTypeColor = window.getFileTypeColor || (() => 0x64748b);
  
  nodes.forEach((node, index) => {
    // Calculate 3D position
    const x = (node.x - (minX + maxX) / 2) * scale;
    const y = ((minY + maxY) / 2 - node.y) * scale; // Flip Y for Three.js
    const z = calculateZDepth(node);
    
    // Store 3D position
    node.x3d = x;
    node.y3d = y;
    node.z3d = z;
    
    // Node size based on changes
    const radius = Math.max(3, Math.min(12, Math.sqrt(node.changes || 1) * 1.5));
    
    // Color based on cluster or file type
    let color = 0x64748b;
    if (node.cluster && navigatorState.clusters.length > 0) {
      const cluster = navigatorState.clusters.find(c => c.id === node.cluster);
      if (cluster) {
        color = parseInt(cluster.color.replace('#', ''), 16);
      }
    } else {
      const fileColor = getFileTypeColor(node.ext);
      color = typeof fileColor === 'string' ? parseInt(fileColor.replace('#', ''), 16) : fileColor;
    }
    
    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.2,
      shininess: 30
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.userData = { node: node, index: index };
    
    nodeMeshes.push(mesh);
    nodeGroup.add(mesh);
    
    // Add label sprite (optional, can be toggled)
    if (navigatorState.labelsVisible) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 64;
      
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#F8FAFC';
      context.font = '24px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(node.name || 'file', canvas.width / 2, canvas.height / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(40, 10, 1);
      sprite.position.set(x, y + radius + 15, z);
      sprite.userData = { node: node };
      
      nodeGroup.add(sprite);
    }
  });
  
  // Create links (edges)
  const linkGroup = new THREE.Group();
  scene.add(linkGroup);
  
  const linkGeometry = new THREE.BufferGeometry();
  const linkPositions = [];
  const linkColors = [];
  
  links.forEach(link => {
    const source = nodes.find(n => n.id === (link.source?.id || link.source));
    const target = nodes.find(n => n.id === (link.target?.id || link.target));
    
    if (!source || !target || !source.x3d || !target.x3d) return;
    
    // Add start and end positions
    linkPositions.push(source.x3d, source.y3d, source.z3d);
    linkPositions.push(target.x3d, target.y3d, target.z3d);
    
    // Color based on relationship type
    let color = new THREE.Color(0x64748b);
    if (link.sameWorkspace && link.sameDirectory) {
      color = new THREE.Color(0x10b981); // Green
    } else if (link.sameWorkspace) {
      color = new THREE.Color(0x3b82f6); // Blue
    } else if (link.sameDirectory) {
      color = new THREE.Color(0x8b5cf6); // Purple
    }
    
    const opacity = link.similarity || 0.3;
    color.multiplyScalar(opacity);
    
    linkColors.push(color.r, color.g, color.b, opacity);
    linkColors.push(color.r, color.g, color.b, opacity);
  });
  
  linkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linkPositions, 3));
  linkGeometry.setAttribute('color', new THREE.Float32BufferAttribute(linkColors, 4));
  
  const linkMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    linewidth: 1
  });
  
  const linkLines = new THREE.LineSegments(linkGeometry, linkMaterial);
  linkGroup.add(linkLines);
  
  // Add grid helper for depth reference
  const gridHelper = new THREE.GridHelper(800, 20, 0x475569, 0x334155);
  gridHelper.position.y = -250;
  scene.add(gridHelper);
  
  // Add axes helper
  const axesHelper = new THREE.AxesHelper(100);
  scene.add(axesHelper);
  
  // Raycaster for mouse interaction
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // Mouse interaction
  let hoveredMesh = null;
  
  function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeMeshes);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      if (hoveredMesh !== mesh) {
        if (hoveredMesh) {
          hoveredMesh.material.emissiveIntensity = 0.2;
          hoveredMesh.scale.set(1, 1, 1);
        }
        hoveredMesh = mesh;
        mesh.material.emissiveIntensity = 0.6;
        mesh.scale.set(1.2, 1.2, 1.2);
        
        // Show tooltip
        if (window.showNavigatorFileTooltip) {
          window.showNavigatorFileTooltip(event, mesh.userData.node);
        }
      }
    } else {
      if (hoveredMesh) {
        hoveredMesh.material.emissiveIntensity = 0.2;
        hoveredMesh.scale.set(1, 1, 1);
        hoveredMesh = null;
        
        if (window.hideNavigatorFileTooltip) {
          window.hideNavigatorFileTooltip();
        }
      }
    }
  }
  
  function onMouseClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeMeshes);
    
    if (intersects.length > 0) {
      const node = intersects[0].object.userData.node;
      if (window.showFileInfo) {
        window.showFileInfo(node);
      }
    }
  }
  
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);
  
  // Animation loop
  let animationId = null;
  let isPaused = false;
  
  function animate() {
    if (isPaused) return;
    
    animationId = requestAnimationFrame(animate);
    
    if (controls && controls.update) {
      controls.update();
    }
    
    // Optional: subtle rotation animation
    if (navigatorState.autoRotate) {
      nodeGroup.rotation.y += 0.001;
    }
    
    renderer.render(scene, camera);
  }
  
  animate();
  
  // Store animation ID for cleanup
  navigatorState.animationId3D = animationId;
  
  // Pause/resume functions
  navigatorState.pause3D = function() {
    isPaused = true;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
  
  navigatorState.resume3D = function() {
    if (isPaused) {
      isPaused = false;
      animate();
    }
  };
  
  // Handle resize
  function onWindowResize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
  }
  
  window.addEventListener('resize', onWindowResize);
  
  // Store references for cleanup and updates
  navigatorState.scene3D = scene;
  navigatorState.camera3D = camera;
  navigatorState.renderer3D = renderer;
  navigatorState.controls3D = controls;
  navigatorState.nodeMeshes3D = nodeMeshes;
  navigatorState.linkGroup3D = linkGroup;
  navigatorState.nodeGroup3D = nodeGroup;
  
  // Cleanup function
  navigatorState.cleanup3D = function() {
    // Cancel animation
    if (navigatorState.animationId3D) {
      cancelAnimationFrame(navigatorState.animationId3D);
    }
    
    window.removeEventListener('resize', onWindowResize);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('click', onMouseClick);
    
    // Dispose geometries and materials
    nodeMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    
    if (linkGeometry) linkGeometry.dispose();
    if (linkMaterial) linkMaterial.dispose();
    
    if (renderer) renderer.dispose();
    
    // Clear references
    navigatorState.scene3D = null;
    navigatorState.camera3D = null;
    navigatorState.renderer3D = null;
    navigatorState.controls3D = null;
    navigatorState.nodeMeshes3D = null;
    navigatorState.linkGroup3D = null;
    navigatorState.nodeGroup3D = null;
  };
  
}

/**
 * Update 3D positions when interpolation changes
 */
function updateNavigator3DPositions() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  if (!navigatorState.nodeMeshes3D || !navigatorState.nodes) return;
  
  const t = navigatorState.interpolation;
  
  navigatorState.nodes.forEach((node, index) => {
    const phys = navigatorState.physicalPositions.get(node.id);
    const lat = navigatorState.latentPositions.get(node.id);
    
    if (phys && lat && navigatorState.nodeMeshes3D[index]) {
      // Interpolate 2D positions
      const x2d = phys.x * (1 - t) + lat.x * t;
      const y2d = phys.y * (1 - t) + lat.y * t;
      
      // Normalize to 3D space
      const xs = navigatorState.nodes.map(n => {
        const p = navigatorState.physicalPositions.get(n.id);
        const l = navigatorState.latentPositions.get(n.id);
        return p && l ? p.x * (1 - t) + l.x * t : n.x;
      });
      const ys = navigatorState.nodes.map(n => {
        const p = navigatorState.physicalPositions.get(n.id);
        const l = navigatorState.latentPositions.get(n.id);
        return p && l ? p.y * (1 - t) + l.y * t : n.y;
      });
      
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const scale = Math.min(400 / rangeX, 400 / rangeY);
      
      const x = (x2d - (minX + maxX) / 2) * scale;
      const y = ((minY + maxY) / 2 - y2d) * scale;
      const z = node.z3d || 0;
      
      node.x3d = x;
      node.y3d = y;
      node.z3d = z;
      
      const mesh = navigatorState.nodeMeshes3D[index];
      if (mesh) {
        mesh.position.set(x, y, z);
      }
    }
  });
  
  // Update links
  if (navigatorState.linkGroup3D && navigatorState.links) {
    // Rebuild link geometry
    const linkPositions = [];
    navigatorState.links.forEach(link => {
      const source = navigatorState.nodes.find(n => n.id === (link.source?.id || link.source));
      const target = navigatorState.nodes.find(n => n.id === (link.target?.id || link.target));
      
      if (source && target && source.x3d !== undefined && target.x3d !== undefined) {
        linkPositions.push(source.x3d, source.y3d, source.z3d);
        linkPositions.push(target.x3d, target.y3d, target.z3d);
      }
    });
    
    const linkLines = navigatorState.linkGroup3D.children[0];
    if (linkLines && linkLines.geometry) {
      linkLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linkPositions, 3));
      linkLines.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// Export to window
window.renderNavigator3D = renderNavigator3D;
window.updateNavigator3DPositions = updateNavigator3DPositions;

