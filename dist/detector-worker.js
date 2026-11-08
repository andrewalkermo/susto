'use strict';
// Keep scheduling independent of the page's rendering loop.
setInterval(() => postMessage('tick'), 40);
