export type MessageCallback<T> = (data: T) => void

export default class Emitter {
	messageCallbacks: Map<string, Set<MessageCallback<any>>>

	constructor() {
		this.messageCallbacks = new Map<string, Set<MessageCallback<any>>>()
	}

	on<T>(id: string, cb: MessageCallback<T>) {
		let set = this.messageCallbacks.get(id)
		if (set == null) {
			set = new Set()
			set.add(cb)
			this.messageCallbacks.set(id, set)
		} else {
			set.add(cb)
		}
		return set.size
	}

	off<T>(id: string, cb: MessageCallback<T>) {
		const set = this.messageCallbacks.get(id)
		if (set == null) {
			return 0
		}
		set.delete(cb)
		if (set.size > 0) {
			return set.size
		}
		this.messageCallbacks.delete(id)
		return 0
	}

	once<T>(id: string, cb: MessageCallback<T>) {
		this.on(id, function f(data: T) {
			this.off(id, f)
			cb(data)
		})
	}

	one<T>(id: string): Promise<T> {
		return new Promise<T>(res => this.once(id, res))
	}
}
