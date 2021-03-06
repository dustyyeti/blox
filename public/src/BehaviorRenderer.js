

export class XRSupport {

	static supportsARKit() {
		if(typeof window.webkit === 'undefined' || !navigator.xr) return false
		return true
	}

	getContext(canvas=0) {
		this.device = 0
		this.session = 0
		this.xrCanvas = 0
		this.xrContext = 0
		this.canvas = canvas
		this.context = 0
		this.xrCanvas = document.createElement('canvas')
		this.xrContext = this.xrCanvas.getContext('xrpresent')
		let p = new Promise((resolve, reject) => {
			// document.body.insertBefore(this.xrCanvas, document.body.firstChild) <- not needed?
			navigator.xr.requestDevice().then((xrDevice)=>{
				this.device = xrDevice
				this.device.requestSession({ outputContext: this.xrContext }).then((xrSession)=>{
					this.session = xrSession
					if(!this.canvas) this.canvas = document.createElement('canvas')
					if(!this.context) this.context = this.canvas.getContext('webgl', { compatibleXRDevice: this.device })
					this.session.baseLayer = new XRWebGLLayer(this.session, this.context)
					resolve(this.context)
				}).catch(err => {
					console.error('Session setup error', err)
					reject()
				})
			}).catch(err => {
				console.error('Error', err)
				reject()
			})
		})
		return p
	}

	setAnimationLoop(userAnimationCallback) {
		this.userAnimationCallback = userAnimationCallback
		this.__handleAnimationFrame = this._handleAnimationFrame.bind(this)

		// head-model is the coordinate system that tracks the position of the display
		this.session.requestFrameOfReference('head-model').then(frameOfReference =>{
			this.headFrameOfReference = frameOfReference

			// get eye level which is somehow different from head level?
			this.session.requestFrameOfReference('eye-level').then(frameOfReference => {
				this.eyeLevelFrameOfReference = frameOfReference
				this.session.requestAnimationFrame(this.__handleAnimationFrame)
			}).catch(err => {
				console.error('Error finding eye frame of reference', err)
			})

		}).catch(err => {
			console.error('Error finding head frame of reference', err)
		})

	}

	_handleAnimationFrame(time=0, frame=0){

		if(!this.session || this.session.ended) return

		this.session.requestAnimationFrame(this.__handleAnimationFrame)

		let pose = frame.getDevicePose(this.eyeLevelFrameOfReference)
		if(!pose){
			console.log('No pose')
			return
		}

		for (let view of frame.views) {
			this.userAnimationCallback(
				this.session.baseLayer.getViewport(view),
				view.projectionMatrix,
				pose.getViewMatrix(view),
			)
			break
		}
	}

	getAnchor(xyz) {
		// returns a promise
		return this.session.addAnchor(xyz, this.headFrameOfReference)
	}

}


export class BehaviorRenderer {

	constructor() {

		this.clock = new THREE.Clock()
		this.canvas = document.createElement('canvas')
		this.scene = 0
		this.camera = 0
		this.composer = 0
		this.selectedObjects = []

		if(XRSupport.supportsARKit()) {
			this.xr = new XRSupport()
			this.xr.getContext(this.canvas).then((context) => {
				this.setupRenderer(0,this.canvas,context)
				this.xr.setAnimationLoop( this.animateCamera.bind(this) )
			}).catch(err => {
				console.error('Error', err)
			})
		} else {
			this.setupRenderer(0,this.canvas,0)
			this.renderer.setAnimationLoop( this.animate.bind(this) )
			document.body.appendChild( this.canvas )
		}
	}

	set_scene(scene) {
		this.scene = scene
	}

	set_camera(camera) {
		this.camera = camera
	}

	animate() {
		if(!this.scene || !this.camera) return
		this.blox.on_event({blox:this.blox,name:"on_tick",interval:this.clock.getElapsedTime()})
		this.outlinePass.renderScene = this.renderPass.scene = this.scene
		this.outlinePass.renderCamera = this.renderPass.camera = this.camera
		this.composer.render()
	}

	animateCamera(bounds,projectionMatrix,viewMatrix) {
		if(!this.scene || !this.camera) return
		this.camera.matrixAutoUpdate = false
		this.camera.matrix.fromArray(viewMatrix)
		this.camera.updateMatrixWorld()
		this.camera.projectionMatrix.fromArray(projectionMatrix)
		this.animate()
	}

	setupRenderer(bounds,canvas,context) {

		let width = bounds ? bounds.width : window.innerWidth
		let height = bounds ? bounds.height : window.innerHeight

		this.canvas = canvas
		this.context = context

		this.renderer = new THREE.WebGLRenderer({canvas:this.canvas,context:this.context,antialias:false,alpha:false})
		this.renderer.autoClear = false
		this.renderer.setPixelRatio(1)
		this.renderer.setSize(width,height)

		this.composer = new THREE.EffectComposer( this.renderer )
        this.composer.setSize( width, height );

		this.renderPass = new THREE.RenderPass( this.scene, this.camera )
		this.composer.addPass( this.renderPass )

		let outlinePass = this.outlinePass = new THREE.OutlinePass( new THREE.Vector2( width, height ), this.scene, this.camera )
		// outlinePass.edgeStrength = Number( 5 );
		// outlinePass.edgeGlow = Number( 1 );
		// outlinePass.edgeThickness = Number( 8 );
		// outlinePass.pulsePeriod = Number( 1 );
		// outlinePass.usePatternTexture =  true;
		// outlinePass.visibleEdgeColor.set( value );
		// outlinePass.hiddenEdgeColor.set( value );
		this.composer.addPass( this.outlinePass )
		this.outlinePass.selectedObjects = this.selectedObjects

		let loader = new THREE.TextureLoader();
		loader.load( './art/tri_pattern.jpg', (texture) => {
			this.outlinePass.patternTexture = texture;
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;	
		});
		this.effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
		this.effectFXAA.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );
		this.effectFXAA.renderToScreen = true;
		this.composer.addPass( this.effectFXAA );

	}

	selected(mesh) {
		this.selectedObjects.push(mesh)
	}

}

