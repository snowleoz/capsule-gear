import { descriptionToParticle, forFun, PARTICLE_FLAG, hasOwnProperty, PARTICLE_TOP, getLastParticleOrder, getAllKeyByFlatParticle } from './utils'
import { Description, ParticleInfo, FlatParticle, ParticleItem, CallbackStatusParam } from './types'
import { cloneDeep } from 'lodash'

export interface IOption {
  /** 描述 */
  description: Description | Description[]
  /** 描述控制器，在遍历描述信息时，会调用该回调 */
  controller?: (ParticleItem: ParticleItem, status?: CallbackStatusParam) => void
}

class Particle {
  #particle: ParticleInfo
  #controller: IOption['controller']
  constructor(options: IOption) {
    const { description, controller } = options
    if (!description) {
      throw new Error(`Invaild description field, description is ${description}`)
    }
    this.#controller = controller
    this.#particle = descriptionToParticle(description, this, controller, {
      type: 'append'
    })
  }
  append(key: string, description: Description | Description[], order?: number) {
    const parent = this.#particle.flatParticle[key]
    const lastParticleOrder = parent ? getLastParticleOrder(parent) : -1
    if (parent && lastParticleOrder >= 0) {
      const formatDesc = Array.isArray(description) ? description : [description]
      // 对配置进行格式化
      const { particleTree: appendParticleTree, flatParticle: appendFlatParticle, particles: appendParticles } = descriptionToParticle(formatDesc, this)
      // 将配置插入到指定父节点中
      parent.children = parent.children || []
      const parentChildLen = parent.children.length
      order = order !== undefined && parentChildLen && order < parentChildLen ? order : parent.children.length
      parent.children.splice(order, 0, ...(appendParticleTree as ParticleItem[]))
      const particleExtra = parent[PARTICLE_FLAG]
      // 对新插入的数据进行格式化，更正关联字段PARTICLE_FLAG中的数据
      forFun(parent.children, (item, index) => {
        item[PARTICLE_FLAG] = {
          parent: key,
          index,
          layer: `${particleExtra.layer}-${index}`,
          // order会在之后更正
          order: -1
        }
      })
      // 新增配置的key
      const appendParticleKeys: string[] = []
      // 重新遍历已经解析的配置，将新增配置的子节点layer信息更正
      forFun(appendParticles, item => {
        const itemParticleExtra = item[PARTICLE_FLAG]
        const { parent, layer: itemLayer } = itemParticleExtra
        if (parent !== key) {
          const itemParent = appendFlatParticle[parent]
          const itemParentParticleExtra = itemParent![PARTICLE_FLAG]
          const { layer: parentLayer } = itemParentParticleExtra
          const newItemLayer = `${parentLayer.slice(0, parentLayer.lastIndexOf('-'))}-${itemLayer.slice(itemLayer.lastIndexOf('-') + 1)}`
          itemParticleExtra.layer = newItemLayer
        }
        appendParticleKeys.push(item.key)
      })
      // 新增的节点插入有序的字段集合中
      this.#particle.particles.splice(lastParticleOrder + 1, 0, ...appendParticles)
      // 重新对所有字段进行排序
      forFun(this.#particle.particles, (item, index) => {
        item[PARTICLE_FLAG].order = index
      })
      // 合并新增数据到打平树中
      Object.assign(this.#particle.flatParticle, appendFlatParticle)
      const callbackStatus: CallbackStatusParam = {
        type: 'append',
        operationKey: [key],
        relatKey: appendParticleKeys
      }
      // 调用回调函数
      forFun(appendParticles, item => {
        this.#controller && this.#controller(item, callbackStatus)
      })
    }
  }
  remove(keys: string[]) {
    const allKeys = getAllKeyByFlatParticle(keys, this.#particle.flatParticle)
    forFun(allKeys, key => {
      const flatParticle = this.#particle.flatParticle
      const item = flatParticle[key]
      if (item) {
        const particleExtra = item[PARTICLE_FLAG]
        const { parent, index } = particleExtra
        const parentItem = flatParticle[parent]
        if (parentItem) {
          parentItem.children!.splice(index, 1)
          forFun(parentItem.children!, (item, index) => {
            const particleExtra = item[PARTICLE_FLAG]
            const { layer } = particleExtra
            item[PARTICLE_FLAG] = {
              ...particleExtra,
              index,
              layer: `${layer.slice(0, layer.length - 1)}${index}`
            }
          })
        }
        this.#controller &&
          this.#controller(item, {
            type: 'remove',
            operationKey: keys,
            relatKey: allKeys
          })
        delete flatParticle[key]
      }
    })
    this.#particle.particles = this.#particle.particles.filter(item => allKeys.indexOf(item.key) === -1)
    forFun(this.#particle.particles, (item, index) => {
      item[PARTICLE_FLAG].order = index
    })
  }
  setItem(key: string, data: Record<string, any>) {
    const item = this.#particle.flatParticle[key]
    if (item) {
      if (hasOwnProperty(data, 'key') || hasOwnProperty(data, 'children') || hasOwnProperty(data, PARTICLE_FLAG)) {
        console.error(`Setting key or children or ${PARTICLE_FLAG} is not allowed`)
        return false
      }
      const cloneData = cloneDeep(data)
      Object.assign(item, cloneData)
      this.#controller &&
        this.#controller(item, {
          type: 'setItem',
          operationKey: [key],
          relatKey: [key]
        })
      return true
    } else {
      console.error(`Cannot find element to set, key is ${key}`)
      return false
    }
  }
  getItem(keys?: string[], dataType: 'object' | 'array' = 'object') {
    if (!keys) {
      return dataType === 'object' ? this.#particle.flatParticle : Object.values(this.#particle.flatParticle)
    }
    const result: FlatParticle | Record<string, undefined> = {}
    forFun(keys, key => {
      const item = this.#particle.flatParticle[key]
      if (item) {
        result[key] = item
      }
    })
    return dataType === 'object' ? result : Object.values(result)
  }
  getParticle() {
    return this.#particle.particleTree
  }
  replace(key: string, description: Description) {
    const replaceItem = this.#particle.flatParticle[key]
    if (replaceItem) {
      const { parent, index } = replaceItem[PARTICLE_FLAG]
      const parentItem = this.#particle.flatParticle[parent]
      const cloneDescription = cloneDeep(description)
      cloneDescription[PARTICLE_FLAG] = replaceItem[PARTICLE_FLAG]
      parentItem!.children!.splice(index, 1, cloneDescription)
      this.#particle.flatParticle[key] = cloneDescription as ParticleItem
    } else {
      throw new Error(`The element to be replaced does not exist, key is ${key}`)
    }
  }
}

export * from './types'
export { PARTICLE_FLAG, PARTICLE_TOP }
export default Particle
