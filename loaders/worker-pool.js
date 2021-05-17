class WorkerPool {
  constructor(workerLimit = 4, workerConfig = {}) {
    this.workerLimit = workerLimit
    this.workerConfig = workerConfig

    this.workerPool = []
    this.workerNextTaskID = 0
    this.taskCache = new WeakMap()
  }

  async getWorker(transcoderPending, taskCost) {
    const [workerSourceURL, wasmBinary] = await transcoderPending

    this.workerNextTaskID++
    const taskId = this.workerNextTaskID

    if (this.workerPool.length < this.workerLimit) {
      const worker = new Worker(workerSourceURL)

      worker._callbacks = {}
      worker._taskCosts = {}
      worker._taskLoad = 0

      worker.postMessage({
        type: 'init',
        config: { ...this.workerConfig, wasmBinary }
      })

      worker.onmessage = function(e) {
        const message = e.data

        switch (message.type) {
          case 'decode':
            worker._callbacks[message.id].resolve(message)
            break
          case 'error':
            worker._callbacks[message.id].reject(message)
            break
          default:
            // eslint-disable-next-line no-console
            console.error(message)
        }
      }

      this.workerPool.push(worker)
    } else {
      this.workerPool.sort((a, b) => (a._taskLoad > b._taskLoad ? -1 : 1))
    }

    const worker = this.workerPool[this.workerPool.length - 1]
    worker._taskCosts[taskId] = taskCost
    worker._taskLoad += taskCost
    return { worker, taskId }
  }

  hasTask(taskKey, buffer) {
    if (this.taskCache.has(buffer)) {
      const { key, promise } = this.taskCache.get(buffer)
      if (key === taskKey) return promise
    }

    return false
  }

  releaseTask(worker, taskID) {
    worker._taskLoad -= worker._taskCosts[taskID]
    delete worker._callbacks[taskID]
    delete worker._taskCosts[taskID]
  }

  dispose() {
    for (let i = 0; i < this.workerPool.length; ++i) {
      this.workerPool[i].terminate()
    }

    this.workerPool = []
  }
}

module.exports = WorkerPool
