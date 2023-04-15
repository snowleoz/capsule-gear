declare global {
	interface Function {
		toJSON?: () => any
	}
}

/** 描述 */
export type Description = {
	key: string
	children?: Array<Description>
	[key: string]: any
}

// export type ParticleOption = {
// }

/** 格式化后的元素 */
export type ParticleItem = Description & {
	__particle: {
		/** 父级的key */
		parent: string
		/** 在子元素中的位置 */
		index: number
		/** 层级记录 */
		layer: string
		/** 遍历顺序 */
		order: number
	}
	children?: Array<ParticleItem>
}

/** 用于descriptionToParticle转换时的数据类型 */
export type PartialParticleItem = Description & {
	__particle: {
		/** 父级的key */
		parent?: string
		/** 在子元素中的位置 */
		index?: number
		/** 层级记录 */
		layer?: string
		/** 遍历顺序 */
		order?: number
	}
	children?: Array<PartialParticleItem>
}

/** 描述控制器，在遍历描述信息时，会调用该回调 */
export type Controller = (ParticleItem: ParticleItem) => void | false
