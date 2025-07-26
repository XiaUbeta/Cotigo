class VisualEngine {
    constructor(canvasId, fluidCanvasId) {
        this.canvasId = canvasId;
        this.fluidCanvasId = fluidCanvasId;
        this.canvas = document.getElementById(canvasId);
        this.fluidCanvas = document.getElementById(fluidCanvasId);
        
        // Three.js 基础设置
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.particleSystem = null;
        this.galaxy = null;
        
        // 螺旋星系参数
        this.galaxyParams = {
            arms: 6,
            starsPerArm: 1000,
            armAngle: 270 / 6,
            radius: 25,
            rotationSpeed: 0.0001
        };
        
        // 当前指标状态 - 脑机接口提供的六个参数
        this.currentMetrics = {
            stress: 0,
            attention: 0,
            relaxation: 0,
            engagement: 0,
            excitement: 0,
            interest: 0
        };
        
        // 紧张度计算参数
        this.tensionCalculation = {
            // 各指标权重 (总和为1.0，可根据实际效果调整)
            weights: {
                stress: 0.4,        // 压力是主要因素
                excitement: 0.25,   // 兴奋度也会造成紧张
                engagement: -0.15,  // 专注投入可以减轻紧张(负权重)
                attention: -0.1,    // 注意力集中也有助于减轻紧张
                relaxation: -0.3,   // 放松直接对抗紧张(负权重)
                interest: -0.1      // 兴趣可以减轻紧张感
            },
            // 平滑因子，避免数值跳跃过大
            smoothingFactor: 0.85
        };
        
        // 粒子混乱系统
        this.chaosSystem = {
            currentTensionLevel: 0,
            targetTensionLevel: 0,
            originalPositions: [],      // 保存粒子原始位置
            chaosOffsets: [],           // 混乱偏移量
            chaosVelocities: [],        // 混乱速度
            maxChaosRadius: 8.0,        // 最大混乱半径
            chaosFrequency: 0.02,       // 混乱变化频率
            chaosIntensity: 1.0,        // 混乱强度倍数
            noiseOffset: 0              // 噪声偏移，用于生成更自然的混乱
        };
        
        
        // 呼吸引导球体
        this.breathingSphere = null;
        this.breathingGuide = {
            isActive: false,
            phase: 'inhale', // inhale, hold1, exhale, hold2
            startTime: 0,
            cycle: {
                inhale: 4000,    // 吸气4秒
                hold1: 1000,     // 屏息1秒
                exhale: 6000,    // 呼气6秒
                hold2: 1000      // 屏息1秒
            },
            baseRadius: 0.5,
            maxRadius: 1.5,
            currentRadius: 0.5
        };
        
        // 动画状态
        this.isRunning = false;
        this.animationId = null;
        
        // 着色器
        this.shaderMaterial = null;
        this.uniforms = {};
        this.attributes = {};
        
        this.init();
    }
    
    init() {
        if (!this.canvas) {
            console.error('Canvas element not found:', this.canvasId);
            return;
        }
        
        this.setupThreeJS();
        this.createSpiralGalaxy();
        this.createBreathingSphere();
        console.log('Visual Engine initialized with spiral galaxy and breathing guide');
    }
    
    setupThreeJS() {
        // 创建场景
        this.scene = new THREE.Scene();
        
        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.canvas.clientWidth / this.canvas.clientHeight, 
            0.1, 
            10000
        );
        this.camera.position.z = 6;
        this.camera.position.y = 6;
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.sortObjects = true; // 确保深度排序
        this.renderer.autoClear = false;
        
        // 添加轨道控制（可选，用于调试）
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }
        
        // 处理窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    createSpiralGalaxy() {
        // 创建圆形纹理
        const circleTexture = new THREE.Texture(this.generateCircleTexture());
        circleTexture.needsUpdate = true;
        
        // 设置着色器属性
        this.attributes = {
            size: { type: 'f', value: [] },
            ca: { type: 'c', value: [] }
        };
        
        this.uniforms = {
            amplitude: { type: "f", value: 1.0 },
            color: { type: "c", value: new THREE.Color(0xffffff) },
            texture: { type: "t", value: circleTexture },
            time: { type: "f", value: 0.0 },
            relaxationLevel: { type: "f", value: 0.0 },
            tensionLevel: { type: "f", value: 0.0 }
        };
        
        this.uniforms.texture.value.wrapS = this.uniforms.texture.value.wrapT = THREE.RepeatWrapping;
        
        // 创建着色器材质
        this.shaderMaterial = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            attributes: this.attributes,
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        // 创建星系几何体
        this.galaxy = new THREE.Geometry();
        this.generateGalaxyVertices();
        
        // 创建粒子系统
        this.particleSystem = new THREE.ParticleSystem(this.galaxy, this.shaderMaterial);
        this.particleSystem.sortParticles = true;
        
        // 设置粒子属性
        this.setupParticleAttributes();
        
        // 初始化混乱系统
        this.initializeChaosSystem();
        
        // 添加到场景
        this.scene.add(this.particleSystem);
    }
    
    createBreathingSphere() {
        // 创建全新的高级恒星球体系统
        this.breathingSphereGroup = new THREE.Object3D();
        
        // 恒星色彩状态控制 - 初始为金色调，匹配中央粒子
        this.stellarColorState = {
            hue: 45,         // 初始金色调
            targetHue: 45,  
            saturation: 0.8, 
            brightness: 0.75, 
            temperature: 4500, 
            colorPhase: 'warm', 
            transitionSpeed: 0.02
        };
        
        // === 第1层：粒子球核心 - 替代实体球 ===
        console.log('开始创建粒子球核心...');
        this.createParticleSphereCore();
        
        // 已删除能量光环层
        
        
        // === 优化的立体感光照系统 ===
        if (!this.ambientLight) {
            this.ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.2);
            this.scene.add(this.ambientLight);
        }
        
        if (!this.directionalLight) {
            this.directionalLight = new THREE.DirectionalLight(0x4c4c6a, 0.6);
            this.directionalLight.position.set(5, 8, 6);
            this.directionalLight.castShadow = true;
            this.scene.add(this.directionalLight);
        }
        
        // 核心光源 - 降低强度增强立体感
        this.innerLight = new THREE.PointLight(0x8b5cf6, 1.2, 12);
        this.innerLight.position.set(0, 0, 0);
        this.scene.add(this.innerLight);
        
        // 边缘光源 - 创造更好的立体轮廓
        this.rimLight1 = new THREE.PointLight(0xa78bfa, 0.5, 6);
        this.rimLight1.position.set(2.5, 1, 2);
        this.scene.add(this.rimLight1);
        
        this.rimLight2 = new THREE.PointLight(0x6366f1, 0.5, 6);
        this.rimLight2.position.set(-2.5, -1, 2);
        this.scene.add(this.rimLight2);
        
        // 新增背光源增强轮廓
        this.backLight = new THREE.PointLight(0x3730a3, 0.3, 8);
        this.backLight.position.set(0, 0, -4);
        this.scene.add(this.backLight);
        
        // 将球体组添加到场景 - 设置在粒子系统前方
        this.breathingSphereGroup.position.z = 0.5; // 确保始终在粒子前方
        this.scene.add(this.breathingSphereGroup);
        
        console.log('全新粒子球体已创建 - 粒子核心');
        console.log('球体组位置:', this.breathingSphereGroup.position);
        console.log('球体组子对象数量:', this.breathingSphereGroup.children.length);
    }
    
    createParticleSphereCore() {
        // 创建粒子球核心系统
        const particleCount = 5000;
        const coreRadius = this.breathingGuide.baseRadius * 1.0; // 增大核心半径
        console.log('粒子球半径:', coreRadius, '基础半径:', this.breathingGuide.baseRadius);
        
        // 创建粒子几何体
        const particleGeometry = new THREE.Geometry();
        
        // 粒子材质 - 更亮更大的设置
        const particleMaterial = new THREE.ParticleBasicMaterial({
            size: 0.05, // 大幅增大粒子半径
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending, // 改回加性混合让粒子更亮
            vertexColors: true,
            sizeAttenuation: true, // 启用距离衰减，让球体看起来更立体
            color: 0xffff80 // 更亮的金色
        });
        
        console.log('粒子材质创建完成:', particleMaterial);
        
        // 生成球形分布的粒子
        const colors = [];
        for (let i = 0; i < particleCount; i++) {
            // 使用球形分布算法
            const radius = coreRadius * Math.pow(Math.random(), 0.33); // 立方根分布，中心更密集
            const theta = Math.random() * Math.PI * 2; // 水平角度
            const phi = Math.acos(2 * Math.random() - 1); // 垂直角度（均匀分布）
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            particleGeometry.vertices.push(new THREE.Vector3(x, y, z));
            
            // 根据距离中心的位置设置颜色 - 与中央粒子颜色逻辑匹配
            const distanceFromCenter = radius;
            const normalizedDistance = distanceFromCenter / coreRadius;
            
            // 更明亮的金色调，与背景粒子形成强烈对比
            const color = new THREE.Color();
            const centerBrightness = 0.2 + (1 - normalizedDistance) * 0.3; // 降低整体亮度
            color.setRGB(
                Math.min(1.0, 0.6 * centerBrightness), // 温暖的金色 - 红色分量
                Math.min(1.0, 0.4 * centerBrightness), // 金色 - 绿色分量
                Math.min(1.0, 0.1 * centerBrightness)  // 金色 - 蓝色分量
            );
            colors.push(color);
        }
        
        // 设置粒子颜色
        particleGeometry.colors = colors;
        
        // 创建粒子系统
        this.breathingParticleSphere = new THREE.ParticleSystem(particleGeometry, particleMaterial);
        this.breathingParticleSphere.position.set(0, 0, 0); // 居中显示
        this.breathingParticleSphere.visible = true; // 立即可见
        
        console.log('粒子系统创建完成:', this.breathingParticleSphere);
        console.log('粒子几何体顶点数量:', particleGeometry.vertices.length);
        
        // 简化旋转设置
        this.breathingParticleSphere.rotation.set(0, 0, 0); // 先不旋转
        
        this.breathingSphereGroup.add(this.breathingParticleSphere);
        console.log('粒子球已添加到球体组');
        
        // 保存原始位置用于呼吸动画
        this.particleSphereOriginalPositions = [];
        for (let i = 0; i < particleGeometry.vertices.length; i++) {
            this.particleSphereOriginalPositions.push(particleGeometry.vertices[i].clone());
        }
        
        console.log(`粒子球核心已创建 - ${particleCount} 个粒子`);
        console.log('粒子球位置:', this.breathingParticleSphere.position);
        console.log('粒子球可见性:', this.breathingParticleSphere.visible);
        console.log('粒子材质纹理:', particleMaterial.map);
        console.log('粒子尺寸:', particleMaterial.size);
    }
    
    // 更新恒星色彩状态
    updateStellarColorState(phase, progress) {
        const colorState = this.stellarColorState;
        
        // 根据呼吸阶段设置目标色彩
        switch (phase) {
            case 'inhale':
                // 吸气：从深蓝转向明亮青色
                colorState.targetHue = 200 + progress * 40; // 200-240度
                colorState.saturation = 0.8 - progress * 0.2; // 高饱和度到中饱和度
                colorState.brightness = 0.7 + progress * 0.3; // 逐渐变亮
                colorState.temperature = 6500 + progress * 1500; // 色温升高
                colorState.colorPhase = 'cool';
                break;
                
            case 'hold1':
                // 屏息：纯净的白蓝色，像恒星核心
                colorState.targetHue = 220;
                colorState.saturation = 0.4;
                colorState.brightness = 1.0;
                colorState.temperature = 8000;
                colorState.colorPhase = 'stellar';
                break;
                
            case 'exhale':
                // 呼气：从蓝白色转向温暖的金橙色
                if (progress < 0.5) {
                    colorState.targetHue = 220 - progress * 80; // 220->180
                    colorState.saturation = 0.4 + progress * 0.3;
                    colorState.brightness = 1.0 - progress * 0.2;
                } else {
                    const exhaleProgress = (progress - 0.5) * 2;
                    colorState.targetHue = 180 - exhaleProgress * 140; // 180->40 (金橙色)
                    colorState.saturation = 0.7 + exhaleProgress * 0.2;
                    colorState.brightness = 0.8 + exhaleProgress * 0.2;
                }
                colorState.temperature = 8000 - progress * 2500; // 色温降低
                colorState.colorPhase = progress > 0.7 ? 'warm' : 'neutral';
                break;
                
            case 'hold2':
                // 屏息：深金色，宁静温暖
                colorState.targetHue = 35;
                colorState.saturation = 0.8;
                colorState.brightness = 0.6;
                colorState.temperature = 4500;
                colorState.colorPhase = 'warm';
                break;
        }
        
        // 根据当前指标调整色彩（脑电数据影响）
        this.adjustStellarColorByMetrics();
        
        // 平滑过渡到目标色彩
        const transitionSpeed = colorState.transitionSpeed;
        colorState.hue += (colorState.targetHue - colorState.hue) * transitionSpeed;
        
        // 确保色相在0-360范围内
        if (colorState.hue < 0) colorState.hue += 360;
        if (colorState.hue > 360) colorState.hue -= 360;
    }
    
    // 根据脑电指标调整恒星颜色 - 与中央粒子颜色协调
    adjustStellarColorByMetrics() {
        const colorState = this.stellarColorState;
        const metrics = this.currentMetrics;
        const tensionLevel = this.chaosSystem.currentTensionLevel;
        
        // 直接模拟中央粒子的颜色逻辑
        if (tensionLevel > 0.1) {
            // 紧张时：匹配中央粒子的橙红色调
            const tension = Math.min(1, tensionLevel);
            
            // 转换为HSV色相（橙红色区域）
            colorState.targetHue = 15 - tension * 10; // 15度到5度（橙到红）
            colorState.saturation = 0.85 + tension * 0.1;
            colorState.brightness = 0.6 + tension * 0.3;
        } else {
            // 放松时：匹配中央粒子的温暖金色
            const relaxation = metrics.relaxation;
            
            // 转换为HSV色相（金色区域）
            colorState.targetHue = 45 + relaxation * 15; // 45度到60度（金到黄）
            colorState.saturation = 0.7 + relaxation * 0.2;
            colorState.brightness = 0.6 + relaxation * 0.2;
        }
        
        // 微调：让恒星稍微更亮一些，作为中心焦点
        colorState.brightness = Math.min(0.95, colorState.brightness * 1.15);
    }
    
    // 获取当前恒星颜色的RGB值（用于其他视觉元素同步）
    getCurrentStellarColor() {
        const h = this.stellarColorState.hue / 360;
        const s = this.stellarColorState.saturation;
        const v = this.stellarColorState.brightness;
        
        // HSV转RGB
        const c = v * s;
        const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
        const m = v - c;
        
        let r, g, b;
        
        if (h * 6 < 1) {
            r = c; g = x; b = 0;
        } else if (h * 6 < 2) {
            r = x; g = c; b = 0;
        } else if (h * 6 < 3) {
            r = 0; g = c; b = x;
        } else if (h * 6 < 4) {
            r = 0; g = x; b = c;
        } else if (h * 6 < 5) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255),
            hex: '#' + Math.round((r + m) * 255).toString(16).padStart(2, '0') +
                       Math.round((g + m) * 255).toString(16).padStart(2, '0') +
                       Math.round((b + m) * 255).toString(16).padStart(2, '0')
        };
    }
    
    
    createParticleTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        
        const context = canvas.getContext('2d');
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2;
        
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        
        // 兼容旧版本的纹理创建方式
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createBreathingParticleTexture() {
        const size = 128; // 更大的纹理分辨率
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        
        const context = canvas.getContext('2d');
        const center = size / 2;
        
        // 创建更复杂的径向渐变，模拟发光效果
        const gradient = context.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 1.0)');     // 中心金色
        gradient.addColorStop(0.2, 'rgba(255, 223, 50, 0.9)');  // 亮金色
        gradient.addColorStop(0.4, 'rgba(255, 200, 80, 0.7)');  // 渐变金色
        gradient.addColorStop(0.6, 'rgba(255, 180, 120, 0.4)'); // 外层温暖色
        gradient.addColorStop(0.8, 'rgba(255, 140, 60, 0.2)');  // 边缘橙色
        gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');       // 完全透明
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        
        // 添加内部光芒效果
        context.globalCompositeOperation = 'screen';
        const innerGradient = context.createRadialGradient(center, center, 0, center, center, center * 0.3);
        innerGradient.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
        innerGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        context.fillStyle = innerGradient;
        context.fillRect(0, 0, size, size);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    startBreathingGuide() {
        if (!this.breathingSphereGroup || !this.breathingParticleSphere) return;
        
        this.breathingGuide.isActive = true;
        this.breathingGuide.startTime = Date.now();
        this.breathingGuide.phase = 'inhale';
        
        // 显示所有恒星层
        if (this.breathingParticleSphere) {
            this.breathingParticleSphere.visible = true;
        }
        
        console.log('深邃艺术球体呼吸引导已启动');
        console.log('视觉引擎运行状态:', this.isRunning);
        console.log('当前旋转值:', this.particleSystem.rotation.y);
    }
    
    
    updateBreathingCycle() {
        if (!this.breathingGuide.isActive || !this.breathingParticleSphere) return;
        
        const now = Date.now();
        const elapsed = now - this.breathingGuide.startTime;
        const cycle = this.breathingGuide.cycle;
        
        // 计算总周期时间
        const totalCycleTime = cycle.inhale + cycle.hold1 + cycle.exhale + cycle.hold2;
        const cycleProgress = elapsed % totalCycleTime;
        
        let newPhase = this.breathingGuide.phase;
        let progress = 0;
        
        // 确定当前阶段和进度
        if (cycleProgress < cycle.inhale) {
            newPhase = 'inhale';
            progress = cycleProgress / cycle.inhale;
        } else if (cycleProgress < cycle.inhale + cycle.hold1) {
            newPhase = 'hold1';
            progress = 1;
        } else if (cycleProgress < cycle.inhale + cycle.hold1 + cycle.exhale) {
            newPhase = 'exhale';
            progress = 1 - ((cycleProgress - cycle.inhale - cycle.hold1) / cycle.exhale);
        } else {
            newPhase = 'hold2';
            progress = 0;
        }
        
        // 更新阶段
        if (newPhase !== this.breathingGuide.phase) {
            this.breathingGuide.phase = newPhase;
            this.onBreathingPhaseChange(newPhase);
        }
        
        // 更新球体大小
        const baseRadius = this.breathingGuide.baseRadius;
        const maxRadius = this.breathingGuide.maxRadius;
        const targetRadius = baseRadius + (maxRadius - baseRadius) * progress;
        
        // 平滑过渡到目标大小 - 手动实现lerp函数
        const lerpFactor = 0.05;
        this.breathingGuide.currentRadius = this.breathingGuide.currentRadius + 
            (targetRadius - this.breathingGuide.currentRadius) * lerpFactor;
        
        // 应用缩放 - 多层球体不同缩放效果
        const scaleValue = this.breathingGuide.currentRadius / baseRadius;
        
        // 核心粒子球 - 主要缩放（删除了旧的实体球引用）
        
        
        
        // 粒子球核心 - 呼吸缩放动画
        if (this.breathingParticleSphere) {
            const particleScale = 0.9 + scaleValue * 0.2; // 简化缩放变化
            this.breathingParticleSphere.scale.set(particleScale, particleScale, particleScale);
            
            // 确保始终可见
            this.breathingParticleSphere.visible = true;
            
            // 更新粒子位置以创建更自然的呼吸效果
            if (this.particleSphereOriginalPositions) {
                for (let i = 0; i < this.breathingParticleSphere.geometry.vertices.length; i++) {
                    const originalPos = this.particleSphereOriginalPositions[i];
                    const vertex = this.breathingParticleSphere.geometry.vertices[i];
                    
                    // 根据呼吸阶段调整粒子位置
                    const breathingFactor = 0.9 + scaleValue * 0.2;
                    vertex.copy(originalPos.clone().multiplyScalar(breathingFactor));
                }
                this.breathingParticleSphere.geometry.verticesNeedUpdate = true;
            }
        }
        
        // 根据阶段调整颜色和透明度
        this.updateBreathingSphereAppearance(newPhase, progress);
    }
    
    onBreathingPhaseChange(phase) {
        const phaseNames = {
            inhale: '吸气',
            hold1: '屏息',
            exhale: '呼气', 
            hold2: '屏息'
        };
        
        console.log(`呼吸阶段: ${phaseNames[phase]}`);
        
        // 触发呼吸指令文字更新
        this.showBreathingInstruction(phase);
    }
    
    updateBreathingSphereAppearance(phase, progress) {
        if (!this.breathingParticleSphere || !this.innerLight) return;
        
        // 更新恒星色彩状态
        this.updateStellarColorState(phase, progress);
        
        // 粒子球核心不需要着色器uniforms更新（已替代旧的恒星着色器）
        
        // 已删除能量环更新代码
        
        // 更新光照系统 - 使用恒星色彩
        const stellarColor = this.getCurrentStellarColor();
        const currentColor = new THREE.Color().setRGB(
            stellarColor.r / 255, 
            stellarColor.g / 255, 
            stellarColor.b / 255
        );
        
        switch (phase) {
            case 'inhale':
                this.innerLight.intensity = 1.0 + progress * 0.6;
                break;
            case 'hold1':
                this.innerLight.intensity = 1.6;
                break;
            case 'exhale':
                this.innerLight.intensity = 1.6 - progress * 0.8;
                break;
            case 'hold2':
                this.innerLight.intensity = 0.8;
                break;
        }
        
        this.innerLight.color.copy(currentColor);
        
        // 更新边缘光源
        if (this.rimLight1 && this.rimLight2) {
            this.rimLight1.color.copy(currentColor);
            this.rimLight2.color.copy(currentColor);
            this.rimLight1.intensity = this.innerLight.intensity * 0.3;
            this.rimLight2.intensity = this.innerLight.intensity * 0.3;
        }
        
        // 更新背光源
        if (this.backLight) {
            this.backLight.color.copy(currentColor);
            this.backLight.intensity = this.innerLight.intensity * 0.2;
        }
        
        
        // 更新粒子球核心系统
        if (this.breathingParticleSphere) {
            const stellarColor = this.getCurrentStellarColor();
            
            // 更新粒子颜色以匹配当前恒星色彩
            for (let i = 0; i < this.breathingParticleSphere.geometry.colors.length; i++) {
                const color = this.breathingParticleSphere.geometry.colors[i];
                const distance = this.breathingParticleSphere.geometry.vertices[i].length();
                const normalizedDistance = distance / (this.breathingGuide.baseRadius * 0.8);
                
                // 更明亮的颜色设置，让粒子更显眼
                const brightnessFactor = 0.8 + (1 - normalizedDistance) * 0.3; // 保持适中亮度
                color.setRGB(
                    Math.min(1.0, (stellarColor.r / 255) * brightnessFactor),
                    Math.min(1.0, (stellarColor.g / 255) * brightnessFactor),
                    Math.min(1.0, (stellarColor.b / 255) * brightnessFactor)
                );
            }
            this.breathingParticleSphere.geometry.colorsNeedUpdate = true;
            
            // 根据呼吸阶段调整透明度
            const baseOpacity = 0.5;
            const breathingIntensity = this.innerLight ? this.innerLight.intensity : 1.0;
            const finalOpacity = Math.max(0.3, baseOpacity + (breathingIntensity - 1.0) * 0.1); // 减少呼吸时的亮度变化
            this.breathingParticleSphere.material.opacity = finalOpacity;
        }
    }
    
    showBreathingInstruction(phase) {
        // 获取或创建指令文字元素
        let instructionElement = document.getElementById('breathingInstruction');
        if (!instructionElement) {
            instructionElement = document.createElement('div');
            instructionElement.id = 'breathingInstruction';
            instructionElement.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #ffffff;
                font-size: 26px;
                font-weight: 300;
                font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
                text-align: center;
                z-index: 20;
                pointer-events: none;
                opacity: 0;
                transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                letter-spacing: 3px;
                text-transform: uppercase;
                backdrop-filter: blur(6px);
                background: linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.05) 0%, 
                    rgba(255, 255, 255, 0.02) 100%);
                border-bottom: 1px solid rgba(255, 255, 255, 0.15);
                padding: 14px 36px;
                min-width: 200px;
                line-height: 1.5;
            `;
            document.body.appendChild(instructionElement);
        }
        
        // 设置指令文字 - 极简主义风格
        const instructions = {
            inhale: '吸 气',
            hold1: '屏 息',
            exhale: '呼 气',
            hold2: '准 备'
        };
        
        // 获取当前恒星颜色用于动态着色
        const stellarColor = this.getCurrentStellarColor();
        const colorHex = `rgb(${stellarColor.r}, ${stellarColor.g}, ${stellarColor.b})`;
        
        instructionElement.textContent = instructions[phase];
        
        // 根据阶段应用不同的动画和颜色 - 优雅极简风格
        switch(phase) {
            case 'inhale':
                instructionElement.style.opacity = '0.9';
                instructionElement.style.transform = 'translate(-50%, -50%)';
                instructionElement.style.color = '#ffffff';
                instructionElement.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
                break;
            case 'hold1':
                instructionElement.style.opacity = '0.8';
                instructionElement.style.transform = 'translate(-50%, -50%)';
                instructionElement.style.color = '#f0f0f0';
                instructionElement.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
                break;
            case 'exhale':
                instructionElement.style.opacity = '0.9';
                instructionElement.style.transform = 'translate(-50%, -50%)';
                instructionElement.style.color = '#ffffff';
                instructionElement.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
                break;
            case 'hold2':
                instructionElement.style.opacity = '0.7';
                instructionElement.style.transform = 'translate(-50%, -50%)';
                instructionElement.style.color = '#e0e0e0';
                instructionElement.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
                break;
        }
        
        // 添加优雅的淡入淡出效果
        instructionElement.style.animation = 'breathingFade 3s ease-in-out infinite';
        
        // 确保动画CSS已注入
        this.ensureBreathingAnimationCSS();
        
        // 温和的渐隐效果
        setTimeout(() => {
            if (instructionElement) {
                instructionElement.style.opacity = '0.6';
            }
        }, 1800);
    }
    
    // 确保呼吸动画CSS已注入到页面
    ensureBreathingAnimationCSS() {
        if (!document.getElementById('breathingAnimationStyles')) {
            const style = document.createElement('style');
            style.id = 'breathingAnimationStyles';
            style.textContent = `
                @keyframes breathingFade {
                    0%, 100% { 
                        opacity: 0.9;
                    }
                    50% { 
                        opacity: 0.7;
                    }
                }
                
                #breathingInstruction {
                    animation: breathingFade 3s ease-in-out infinite;
                }
                
                #breathingInstruction::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 50%;
                    width: 0;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.5);
                    transition: width 0.5s ease-in-out;
                    transform: translateX(-50%);
                    animation: lineExpand 3s ease-in-out infinite;
                }
                
                @keyframes lineExpand {
                    0% { width: 30%; }
                    50% { width: 70%; }
                    100% { width: 30%; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    generateGalaxyVertices() {
        const { arms, starsPerArm, armAngle } = this.galaxyParams;
        
        for (let arm = 0; arm < arms; arm++) {
            for (let i = 0; i <= starsPerArm; i++) {
                const radius = i / 40;
                const angle = i / 100 + (armAngle * (arm + 1));
                
                const x = radius * Math.cos(angle) + this.rand();
                const y = this.rand() / 5;
                const z = radius * Math.sin(angle) + this.rand();
                
                // 添加主要恒星
                const randResult = Math.random() * starsPerArm;
                if (randResult < i * i) {
                    this.galaxy.vertices.push(new THREE.Vector3(
                        x + this.rand(), 
                        y + this.rand(), 
                        z + this.rand()
                    ));
                }
                
                // 添加额外恒星增加密度
                this.galaxy.vertices.push(new THREE.Vector3(x, y, z));
                if (this.rand() >= 0) {
                    this.galaxy.vertices.push(new THREE.Vector3(
                        x + this.rand(), 
                        y + this.rand(), 
                        z + this.rand()
                    ));
                }
            }
        }
    }
    
    setupParticleAttributes() {
        const vertices = this.particleSystem.geometry.vertices;
        const values_size = this.attributes.size.value;
        const values_color = this.attributes.ca.value;
        
        for (let v = 0; v < vertices.length; v++) {
            values_size[v] = 0.2 + Math.abs(this.rand());
            values_color[v] = new THREE.Color();
            
            // 根据距离中心的位置设置不同颜色 - 使用更深的基础色
            const distance = vertices[v].length();
            if (distance < 2) {
                // 中心区域 - 深金色
                values_color[v].setRGB(0.8, 0.6, 0.2);
            } else if (distance < 5) {
                // 中间区域 - 中性蓝白
                values_color[v].setRGB(0.5, 0.6, 0.8);
            } else {
                // 外围区域 - 深蓝色
                values_color[v].setRGB(0.3, 0.4, 0.7);
            }
        }
        
        console.log(`初始化 ${vertices.length} 个粒子的颜色和大小属性`);
        console.log('示例颜色值:', values_color.slice(0, 3).map(c => ({r: c.r, g: c.g, b: c.b})));
    }
    
    initializeChaosSystem() {
        const vertices = this.galaxy.vertices;
        const chaosSystem = this.chaosSystem;
        
        // 保存原始位置
        chaosSystem.originalPositions = [];
        chaosSystem.chaosOffsets = [];
        chaosSystem.chaosVelocities = [];
        
        for (let i = 0; i < vertices.length; i++) {
            // 保存原始位置
            chaosSystem.originalPositions.push(vertices[i].clone());
            
            // 初始化混乱偏移和速度
            chaosSystem.chaosOffsets.push(new THREE.Vector3(0, 0, 0));
            chaosSystem.chaosVelocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            ));
        }
        
        console.log(`混乱系统初始化完成，${vertices.length} 个粒子`);
    }
    
    calculateTensionLevel(metrics) {
        const weights = this.tensionCalculation.weights;
        
        // 计算加权紧张度
        let rawTension = 0;
        rawTension += metrics.stress * weights.stress;
        rawTension += metrics.excitement * weights.excitement;
        rawTension += metrics.engagement * weights.engagement;
        rawTension += metrics.attention * weights.attention;
        rawTension += metrics.relaxation * weights.relaxation;
        rawTension += metrics.interest * weights.interest;
        
        // 归一化到 0-1 范围，并应用非线性变换增强效果
        let normalizedTension = Math.max(0, Math.min(1, rawTension));
        
        // 使用平方函数增强高紧张度的效果
        normalizedTension = Math.pow(normalizedTension, 1.5);
        
        // 平滑处理，避免突变
        const smoothingFactor = this.tensionCalculation.smoothingFactor;
        this.chaosSystem.targetTensionLevel = normalizedTension;
        this.chaosSystem.currentTensionLevel = 
            this.chaosSystem.currentTensionLevel * smoothingFactor + 
            normalizedTension * (1 - smoothingFactor);
            
        return this.chaosSystem.currentTensionLevel;
    }
    
    updateChaosSystem() {
        const chaosSystem = this.chaosSystem;
        const tensionLevel = chaosSystem.currentTensionLevel;
        const vertices = this.galaxy.vertices;
        
        if (tensionLevel < 0.01) {
            // 紧张度很低，粒子回归原始位置
            for (let i = 0; i < vertices.length; i++) {
                vertices[i].lerp(chaosSystem.originalPositions[i], 0.05);
                chaosSystem.chaosOffsets[i].multiplyScalar(0.95); // 逐渐减小偏移
            }
            return;
        }
        
        // 更新噪声偏移，让混乱更自然
        chaosSystem.noiseOffset += chaosSystem.chaosFrequency;
        
        // 混乱强度基于紧张度
        const chaosIntensity = tensionLevel * chaosSystem.chaosIntensity;
        const maxRadius = chaosSystem.maxChaosRadius * tensionLevel;
        
        for (let i = 0; i < vertices.length; i++) {
            const original = chaosSystem.originalPositions[i];
            const offset = chaosSystem.chaosOffsets[i];
            const velocity = chaosSystem.chaosVelocities[i];
            
            // 生成基于柏林噪声的混乱运动（简化版）
            const noiseX = this.simpleNoise(i * 0.1 + chaosSystem.noiseOffset);
            const noiseY = this.simpleNoise(i * 0.1 + chaosSystem.noiseOffset + 100);
            const noiseZ = this.simpleNoise(i * 0.1 + chaosSystem.noiseOffset + 200);
            
            // 更新速度（基于噪声和紧张度）
            velocity.x += (noiseX - 0.5) * chaosIntensity * 0.01;
            velocity.y += (noiseY - 0.5) * chaosIntensity * 0.01;
            velocity.z += (noiseZ - 0.5) * chaosIntensity * 0.01;
            
            // 应用阻尼，防止速度无限增长
            velocity.multiplyScalar(0.98);
            
            // 更新偏移
            offset.add(velocity);
            
            // 限制最大混乱半径
            if (offset.length() > maxRadius) {
                offset.normalize().multiplyScalar(maxRadius);
            }
            
            // 距离中心越远的粒子，混乱程度越大
            const distanceFromCenter = original.length();
            const distanceFactor = Math.min(1, distanceFromCenter / 10);
            const finalOffset = offset.clone().multiplyScalar(distanceFactor);
            
            // 应用最终位置
            vertices[i].copy(original).add(finalOffset);
        }
        
        // 标记几何体需要更新
        this.particleSystem.geometry.verticesNeedUpdate = true;
    }
    
    // 简化版柏林噪声函数
    simpleNoise(x) {
        const intX = Math.floor(x);
        const fracX = x - intX;
        
        const a = this.fade(fracX);
        
        const aa = this.pseudoRandom(intX);
        const ab = this.pseudoRandom(intX + 1);
        
        return this.lerp(aa, ab, a);
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    pseudoRandom(x) {
        x = Math.sin(x * 12.9898) * 43758.5453;
        return x - Math.floor(x);
    }
    
    generateCircleTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        
        const context = canvas.getContext('2d');
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2;
        
        for (let i = 1; i < 33; i++) {
            context.beginPath();
            context.arc(centerX, centerY, (radius / 2) + (i / 2), 0, 2 * Math.PI, false);
            context.fillStyle = `rgba(255, 255, 255, ${1 / i})`;
            context.fill();
        }
        
        return canvas;
    }
    
    getVertexShader() {
        return `
            attribute float size;
            attribute vec3 ca;
            
            uniform float time;
            uniform float relaxationLevel;
            uniform float tensionLevel;
            
            varying vec3 vColor;
            varying float vRelaxation;
            varying float vTension;
            
            void main() {
                vColor = ca;
                vRelaxation = relaxationLevel;
                vTension = tensionLevel;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // 根据放松度和紧张度调整粒子大小
                float sizeMultiplier = 0.8 + relaxationLevel * 0.6;
                
                // 紧张时粒子会有轻微闪烁效果
                if (tensionLevel > 0.3) {
                    float flicker = sin(time * 8.0 + position.x * 3.0) * 0.5 + 0.5;
                    sizeMultiplier *= (0.95 + flicker * tensionLevel * 0.1);
                }
                
                float finalSize = size * sizeMultiplier;
                
                gl_PointSize = finalSize * (100.0 / length(mvPosition.xyz));
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }
    
    getFragmentShader() {
        return `
            uniform vec3 color;
            uniform sampler2D texture;
            uniform float relaxationLevel;
            uniform float tensionLevel;
            uniform float time;
            
            varying vec3 vColor;
            varying float vRelaxation;
            varying float vTension;
            
            void main() {
                // 直接使用顶点颜色，移除所有亮度变化
                gl_FragColor = vec4(vColor, 1.0);
                gl_FragColor = gl_FragColor * texture2D(texture, gl_PointCoord);
                
                // 固定透明度
                gl_FragColor.a *= 0.6;
            }
        `;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.animate();
        console.log('Visual Engine started');
    }
    
    
    animate() {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // 更新时间
        this.uniforms.time.value += 0.01;
        
        // 旋转星系 - 确保可见的旋转速度
        const baseRotationSpeed = this.galaxyParams.rotationSpeed;
        const rotationSpeed = baseRotationSpeed * 20; // 大幅增加基础旋转速度，确保可见
        this.particleSystem.rotation.y += rotationSpeed;
        
        // 调试：每秒输出一次旋转状态
        if (Math.floor(this.uniforms.time.value) % 2 === 0 && this.uniforms.time.value % 1 < 0.02) {
            console.log('动画运行中 - 旋转速度:', rotationSpeed, '当前旋转值:', this.particleSystem.rotation.y.toFixed(3));
        }
        
        // 更新混乱系统
        this.updateChaosSystem();
        
        // 更新呼吸引导
        this.updateBreathingCycle();
        
        // 更新球体组的轻微旋转（与星系相反方向）
        if (this.breathingSphereGroup && this.breathingGuide.isActive) {
            this.breathingSphereGroup.rotation.y -= rotationSpeed * 0.3;
            
            // 添加轻微的上下浮动效果
            const time = this.uniforms.time.value;
            this.breathingSphereGroup.position.y = Math.sin(time * 0.5) * 0.1;
            
            // 边缘光源的动态旋转
            if (this.rimLight1 && this.rimLight2) {
                const lightRotation = time * 0.8;
                this.rimLight1.position.x = Math.cos(lightRotation) * 3;
                this.rimLight1.position.z = Math.sin(lightRotation) * 3;
                this.rimLight2.position.x = Math.cos(lightRotation + Math.PI) * 3;
                this.rimLight2.position.z = Math.sin(lightRotation + Math.PI) * 3;
            }
        }
        
        // 更新着色器uniforms
        this.uniforms.relaxationLevel.value = this.currentMetrics.relaxation;
        this.uniforms.tensionLevel.value = this.chaosSystem.currentTensionLevel;
        
        // 更新控制器
        if (this.controls) {
            this.controls.update();
        }
        
        // 渲染
        this.render();
    }
    
    render() {
        // 清空缓冲区
        this.renderer.clear();
        
        // 首先渲染背景粒子系统
        if (this.particleSystem) {
            this.particleSystem.visible = true;
        }
        if (this.breathingSphereGroup) {
            this.breathingSphereGroup.visible = false;
        }
        this.renderer.render(this.scene, this.camera);
        
        // 然后渲染恒星球体（前景）
        if (this.particleSystem) {
            this.particleSystem.visible = false;
        }
        if (this.breathingSphereGroup) {
            this.breathingSphereGroup.visible = true;
        }
        this.renderer.render(this.scene, this.camera);
        
        // 恢复所有对象可见性
        if (this.particleSystem) {
            this.particleSystem.visible = true;
        }
        if (this.breathingSphereGroup) {
            this.breathingSphereGroup.visible = true;
            // 确保粒子球始终可见
            if (this.breathingParticleSphere) {
                this.breathingParticleSphere.visible = true;
            }
        }
    }
    
    updateMetrics(metrics) {
        // 更新所有六个指标
        this.currentMetrics = {
            stress: metrics.stress || 0,
            attention: metrics.attention || 0,
            relaxation: metrics.relaxation || 0,
            engagement: metrics.engagement || 0,
            excitement: metrics.excitement || 0,
            interest: metrics.interest || 0
        };
        
        // 计算综合紧张度
        const tensionLevel = this.calculateTensionLevel(this.currentMetrics);
        
        // 根据指标调整星系的整体表现
        if (this.particleSystem) {
            // 放松度影响粒子的整体色温和亮度
            const relaxationFactor = this.currentMetrics.relaxation;
            const stressFactor = this.currentMetrics.stress;
            
            // 更新粒子颜色强度
            const colors = this.attributes.ca.value;
            for (let i = 0; i < colors.length; i++) {
                const baseColor = colors[i];
                const vertex = this.galaxy.vertices[i];
                const distanceFromCenter = vertex.length();
                
                if (tensionLevel > 0.1) {
                    // 紧张时：明显的红色调
                    const tension = Math.min(1, tensionLevel);
                    
                    // 根据距离中心的位置调整颜色强度
                    if (distanceFromCenter < 2) {
                        // 中心区域 - 明亮橙红色
                        baseColor.setRGB(
                            0.9 + tension * 0.1,
                            Math.max(0.1, 0.5 - tension * 0.4),
                            Math.max(0.05, 0.2 - tension * 0.15)
                        );
                    } else if (distanceFromCenter < 5) {
                        // 中间区域 - 红色
                        baseColor.setRGB(
                            0.8 + tension * 0.2,
                            Math.max(0.1, 0.4 - tension * 0.3),
                            Math.max(0.05, 0.3 - tension * 0.25)
                        );
                    } else {
                        // 外围区域 - 深红色
                        baseColor.setRGB(
                            0.6 + tension * 0.3,
                            Math.max(0.05, 0.3 - tension * 0.25),
                            Math.max(0.05, 0.2 - tension * 0.15)
                        );
                    }
                } else {
                    // 放松时：深色基调，避免过亮
                    const relaxation = relaxationFactor;
                    
                    if (distanceFromCenter < 2) {
                        // 中心区域 - 温暖金色
                        baseColor.setRGB(
                            0.7 + relaxation * 0.2,
                            0.5 + relaxation * 0.2,
                            0.2 + relaxation * 0.1
                        );
                    } else if (distanceFromCenter < 5) {
                        // 中间区域 - 蓝白色
                        baseColor.setRGB(
                            0.4 + relaxation * 0.2,
                            0.5 + relaxation * 0.2,
                            0.7 + relaxation * 0.2
                        );
                    } else {
                        // 外围区域 - 深蓝色
                        baseColor.setRGB(
                            0.2 + relaxation * 0.2,
                            0.3 + relaxation * 0.2,
                            0.6 + relaxation * 0.3
                        );
                    }
                }
            }
            
            // 标记颜色属性需要更新 - 修复更新标记
            if (this.particleSystem && this.particleSystem.geometry) {
                this.particleSystem.geometry.attributes = this.particleSystem.geometry.attributes || {};
                this.particleSystem.geometry.colorsNeedUpdate = true;
                this.particleSystem.geometry.verticesNeedUpdate = true;
            }
            
            // 整体星系的轻微扰动（保留原有逻辑作为补充效果）
            if (tensionLevel > 0.4) {
                const disturbance = (tensionLevel - 0.4) * 0.05;
                this.particleSystem.position.x += (Math.random() - 0.5) * disturbance;
                this.particleSystem.position.z += (Math.random() - 0.5) * disturbance;
            } else {
                // 低紧张度时回归中心
                this.particleSystem.position.x *= 0.98;
                this.particleSystem.position.z *= 0.98;
            }
            
            // 旋转速度也受紧张度影响
            if (tensionLevel > 0.5) {
                // 紧张时旋转更不规律
                this.galaxyParams.rotationSpeed = 0.0001 + tensionLevel * 0.0002;
            } else {
                // 放松时旋转平缓
                this.galaxyParams.rotationSpeed = 0.0001 * (1 + relaxationFactor);
            }
        }
        
        // 调试输出 - 增加更多信息
        if (Math.random() < 0.01) { // 每100帧输出一次
            console.log(`紧张度: ${tensionLevel.toFixed(3)}, 压力: ${stressFactor.toFixed(2)}, 放松: ${relaxationFactor.toFixed(2)}, 颜色状态: ${tensionLevel > 0.1 ? '红色' : '蓝色'}`);
        }
    }
    
    
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    rand() {
        return Math.random() - 0.5;
    }
    
    // 测试紧张度效果（用于调试）
    testTensionEffect(tensionLevel = 0.8) {
        const testMetrics = {
            stress: tensionLevel * 0.7,
            excitement: tensionLevel * 0.5,
            engagement: 0.3,
            attention: 0.4,
            relaxation: Math.max(0, 1 - tensionLevel),
            interest: 0.5
        };
        
        this.updateMetrics(testMetrics);
        console.log(`测试紧张度效果，设置紧张度为: ${tensionLevel}, 实际计算值: ${this.chaosSystem.currentTensionLevel.toFixed(3)}`);
        
        // 延迟检查颜色是否更新
        setTimeout(() => {
            const colors = this.attributes.ca.value;
            const sampleColors = colors.slice(0, 5).map(c => ({
                r: c.r.toFixed(2), 
                g: c.g.toFixed(2), 
                b: c.b.toFixed(2),
                hex: '#' + Math.round(c.r*255).toString(16).padStart(2,'0') + 
                      Math.round(c.g*255).toString(16).padStart(2,'0') + 
                      Math.round(c.b*255).toString(16).padStart(2,'0')
            }));
            console.log('前5个粒子的颜色:', sampleColors);
        }, 100);
    }
    
    // 测试放松状态效果
    testRelaxationEffect(relaxationLevel = 0.9) {
        const testMetrics = {
            stress: 0.1,
            excitement: 0.2,
            engagement: 0.8,
            attention: 0.9,
            relaxation: relaxationLevel,
            interest: 0.7
        };
        
        this.updateMetrics(testMetrics);
        console.log(`测试放松状态效果，设置放松度为: ${relaxationLevel}`);
    }
    
    // 获取混乱系统参数（用于调试和调优）
    getChaosParams() {
        return {
            currentTensionLevel: this.chaosSystem.currentTensionLevel,
            targetTensionLevel: this.chaosSystem.targetTensionLevel,
            chaosIntensity: this.chaosSystem.chaosIntensity,
            maxChaosRadius: this.chaosSystem.maxChaosRadius,
            weights: this.tensionCalculation.weights
        };
    }
    
    // 调整混乱系统参数
    adjustChaosParams(params) {
        if (params.chaosIntensity !== undefined) {
            this.chaosSystem.chaosIntensity = params.chaosIntensity;
        }
        if (params.maxChaosRadius !== undefined) {
            this.chaosSystem.maxChaosRadius = params.maxChaosRadius;
        }
        if (params.weights) {
            Object.assign(this.tensionCalculation.weights, params.weights);
        }
        console.log('混乱系统参数已调整:', params);
    }
    
    // 循环测试不同紧张度（调试用）
    testTensionCycle() {
        let currentLevel = 0;
        const step = 0.1;
        
        const cycle = () => {
            this.testTensionEffect(currentLevel);
            currentLevel += step;
            
            if (currentLevel <= 1.0) {
                setTimeout(cycle, 2000); // 每2秒切换一次
            } else {
                console.log('紧张度测试循环完成');
            }
        };
        
        console.log('开始紧张度循环测试 (0.0 -> 1.0)');
        cycle();
    }
    
    // 直接设置颜色测试（强制测试）
    forceColorTest(isRed = true) {
        const colors = this.attributes.ca.value;
        
        for (let i = 0; i < colors.length; i++) {
            if (isRed) {
                // 强制设置为红色
                colors[i].setRGB(1.0, 0.1, 0.1);
            } else {
                // 强制设置为蓝色
                colors[i].setRGB(0.2, 0.3, 0.8);
            }
        }
        
        // 标记更新
        if (this.particleSystem && this.particleSystem.geometry) {
            this.particleSystem.geometry.colorsNeedUpdate = true;
        }
        
        console.log(`强制设置所有粒子为 ${isRed ? '红色' : '蓝色'}`);
    }
    
    // 获取当前状态信息
    getStatus() {
        return {
            isRunning: this.isRunning,
            particleCount: this.galaxy ? this.galaxy.vertices.length : 0,
            currentMetrics: this.currentMetrics,
            tensionLevel: this.chaosSystem.currentTensionLevel,
            chaosSystemActive: this.chaosSystem.currentTensionLevel > 0.01
        };
    }
}