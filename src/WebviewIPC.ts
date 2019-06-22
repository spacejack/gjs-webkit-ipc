import Emitter, {MessageCallback} from './Emitter'

declare global {
	interface Window {
		webkit: any
		handleIPCMessage (id: string, json?: string): void
		handleIPCMessageBegin (uid: string, id: string): void
		handleIPCMessageChunk (uid: string, chunk: string): void
		handleIPCMessageEnd (uid: string): void
	}
}

class WebviewIPC extends Emitter {
	chunkedMessages: Map<string, {id: string; chunks: string[]}>

	constructor() {
		super()
		this.chunkedMessages = new Map<string, {id: string; chunks: string[]}>()
	}

	send (id: string, data?: any) {
		if (!window.webkit) {
			console.warn('Not a webkit webview')
			return
		}
		if (!window.webkit.messageHandlers[id]) {
			throw new Error(`No webkit.messageHandlers for '${id}'`)
		}
		if (data != null) {
			window.webkit.messageHandlers[id].postMessage(JSON.stringify(data))
		} else {
			window.webkit.messageHandlers[id].postMessage()
		}
	}
}

const ipc = new WebviewIPC()
export default ipc as Emitter

/** A function the GTK app can invoke */
function handleIPCMessage (id: string, json?: string) {
	const set = ipc.messageCallbacks.get(id)
	if (set == null) {
		return
	}
	let data: any
	if (json != null) {
		try {
			data = JSON.parse(json)
		} catch (err) {
			console.error('Error parsing json: ' + json)
			return
		}
	}
	// Call all of the message handler callbacks
	for (const cb of set.values()) {
		cb(data)
	}
}

/** Handle start of a chunked message */
function handleIPCMessageBegin (uid: string, id: string) {
	if (ipc.chunkedMessages.get(uid)) {
		console.error('Already receiving a message for this UID: ' + uid)
		return
	}
	ipc.chunkedMessages.set(uid, {id, chunks: []})
}

/** Handle one chunk of a chunked message */
function handleIPCMessageChunk (uid: string, chunk: string) {
	const cm = ipc.chunkedMessages.get(uid)
	if (!cm) {
		console.error('Unrecognized UID for chunk: ' + uid)
		return
	}
	cm.chunks.push(chunk)
}

/** Handle end of a chunked message */
function handleIPCMessageEnd (uid: string) {
	const cm = ipc.chunkedMessages.get(uid)
	if (!cm) {
		console.error('Unrecognized UID for chunk: ' + uid)
		return
	}
	ipc.chunkedMessages.delete(uid)
	const json = cm.chunks.join('')
	handleIPCMessage(cm.id, json)
}

// Make these globals
window.handleIPCMessage = handleIPCMessage
window.handleIPCMessageBegin = handleIPCMessageBegin
window.handleIPCMessageEnd = handleIPCMessageEnd
window.handleIPCMessageChunk = handleIPCMessageChunk
