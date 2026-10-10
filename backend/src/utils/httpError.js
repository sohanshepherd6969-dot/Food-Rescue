// Throw httpError(404, 'Not found') inside a route; the error handler sends it as JSON.
module.exports = (status, message) => Object.assign(new Error(message), { status });
