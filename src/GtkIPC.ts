import Emitter, {MessageCallback} from './Emitter'

/** Max size of send data */
export const CHUNK_SIZE = 800
/** Message unique ID (incremented every send) */
let msgUid = 0

/** @param webView A Webkit WebView instance */
export default class GtkIPC extends Emitter {
	webView: any

	constructor (webView: any) {
		super()
		this.webView = webView
	}

	/** @override */
	on<T>(id: string, cb: MessageCallback<T>) {
		const isNew = !this.messageCallbacks.get(id)
		const size = super.on(id, cb)
		if (!isNew) {
			return size
		}
		// This is a new id, so setup the Webkit script message handler for it...
		const set = this.messageCallbacks.get(id)!
		const contentManager = this.webView.get_user_content_manager()
		contentManager.connect(`script-message-received::${id}`, (self: any, message: any) => {
			const json = message.get_js_value().to_string()
			const data = json ? JSON.parse(json) : undefined
			for (const cb of set.values()) {
				cb(data)
			}
		})
		contentManager.register_script_message_handler(id)
		return size
	}

	/** @override */
	off<T>(id: string, cb: MessageCallback<T>) {
		const size0 = (this.messageCallbacks.get(id) || {size: 0}).size
		const size = super.off(id, cb)
		if (size > 0 || size0 !== 1) {
			return size
		}
		// Was the last listener for this id. Remove the script message handler...
		const contentManager = this.webView.get_user_content_manager()
		contentManager.unregister_script_message_handler(id)
		// TODO: Probably need a ref to the signal handler... :|
		contentManager.disconnect(`script-message-received::${id}`)
		this.messageCallbacks.delete(id)
		return 0
	}

	/**
	 * Send a message to client-side IPC message handler
	 */
	async send (id: string, data?: any) {
		if (data === undefined) {
			// No data, just a message id
			return runScript(this.webView,
				`handleIPCMessage("${escapeString(id)}")`
			)
		}
		const json = JSON.stringify(data)
		if (json.length < CHUNK_SIZE) {
			// Data fits in a single message
			return runScript(this.webView,
				`handleIPCMessage("${escapeString(id)}","${escapeString(json)}")`
			)
		}
		// Data is too long for a single message - send in chunks
		msgUid += 1
		await runScript(this.webView,
			`handleIPCMessageBegin("${msgUid}","${id}")`
		)
		for (let p = 0; p < json.length; p += CHUNK_SIZE) {
			const chunk = json.substr(p, CHUNK_SIZE)
			await runScript(this.webView,
				`handleIPCMessageChunk("${msgUid}","${escapeString(chunk)}")`
			)
		}
		return runScript(this.webView, `handleIPCMessageEnd("${msgUid}")`)
	}
}

/**
 * Escape a string so it can be used within a double-quoted string.
 */
export function escapeString (str: string) {
	return JSON.stringify(str).slice(1, -1)
}

/**
 * Runs a script directly. Script must already be sanitized!
 */
export function runScript<T = void>(webView: any, script: string): Promise<T> {
	return new Promise<T>((res, rej) => {
		try {
			webView.run_javascript(script, null, (t: T) => {
				res(t)
			})
		} catch (err) {
			rej(err)
		}
	})
}
