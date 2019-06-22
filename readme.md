# GJS IPC

WIP sketch of Inter-Process-Communication between a GTK application's JS and a Webkit webview's JS.

TODO: Needs compiler tooling and to be converted to GJS module system to actually work....

## GTK/Webkit IPC issues

Sending messages from a webview to the GTK application is fairly straightforward with:

    window.webkit.messageHandlers[id].postMessage

Sending messages from a GTK application to a webview is a bit less straightforward. Basically you can communicate by directly invoking JS in the webview context. Eg:

    webView.run_javascript('handleGTKMessage("Hello from GTK!")')

So your webview JS should provide some global function on the window (`handleGTKMessage` in the above example), and the GTK app can invoke that function (as well as send data as parameters to that function.) It may not be practical to send larger amounts of data this way, so this implementation allows for breaking up large messages into smaller chunks.

## API

The APIs for both GTK Webkit are a bit rough around the edges to use directly. This library provides a consistent EventEmitter-style interface for both.

The main difference is that there is just one singleton instance of the Webview IPC, but on the GTK side you must create an instance and provide a WebView widget.

### GTK application example:

```ts
import GtkIPC from './GtkIPC'
// Assuming a WebView has been created...
const ipc = new GtkIPC(webView)
// Listen for 'ping' messages
ipc.on('ping', data => {
    // Respond with 'pong' message
    ipc.send('pong', 'Hello from GTK!')
})
```

### Webview example:

```ts
// IPC is a singleton instance in the Webview
import ipc from './WebviewIPC'
// Setup one-time listener for 'pong' message
ipc.once('pong', data => {console.log(data)})
// Send a 'ping'
ipc.send('ping', 'Hello from webview!')
```

In both cases the message data parameter is optional. If present, it will be serialized and deserialized for you (using JSON under the hood.)
