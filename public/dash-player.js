const env = {
  logging: true,
  version: '0.1.0',
};
const logger = console;
logger.json = (...argv) => {
  if (argv.length === 1) return logger.info(JSON.stringify(argv[0], null, 2));
  logger.info(JSON.stringify({ argv }, null, 2));
};
logger.info(`Version: ${env.version}`);
if (!env.logging) {
  const native = () => {};
  logger.log = native;
  logger.info = native;
  logger.warn = native;
  logger.error = native;
  logger.json = native;
}

class Player {
  constructor(video) {
    this.video = video || document.querySelector('video');
  }
  initialize() {
    const options = {
      headers: this.headers,
    };
    return fetch(this.assetURL, options)
    .then(res => res.text())
    .then(mpd => this.parseMPD(mpd))
    .catch(e => logger.error(e.message));
  }
  parseMPD(mpd) {
    this.infoRange = /Initialization range.+(\d+-\d+)/.exec(mpd)[1];
    const basePath = this.assetURL.indexOf('/') !== -1 ? /(.*\/)/.exec(this.assetURL)[1] : '';
    this.baseURL = `${basePath}${/BaseURL>(.+)<\/BaseURL/.exec(mpd)[1]}`;
    this.segmentDuration = /duration="(\d+)"/.exec(mpd)[1];
    this.segments = mpd.match(/mediaRange="\d+-\d+"/g)
    .map(v => ({ range: /.+"(\d+-\d+)"/.exec(v)[1] }));
    this.mimeType = /mimeType="([\w/]+)"/.exec(mpd)[1];
    this.codecs = /(codecs="[\w\d\.,-]+")/.exec(mpd)[1];
    logger.json({
      infoRange: this.infoRange,
      baseURL: this.baseURL,
      segmentDuration: this.segmentDuration,
      totalSegments: this.segments.length,
      mimeType: this.mimeType,
      codecs: this.codecs,
    });
    if (this.segmentDuration < 5000) this.segmentDuration = 5000;
  }
  play(assetURL, headers) {
    this.assetURL = assetURL || 'frag_bunny_dash.mpd';
    this.headers = headers || {};
    this.queue = [];
    this.initialize()
    .then(() => this.start());
  }
  start() {
    this.mimeCodec = `${this.mimeType}; ${this.codecs}` || 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    if ('MediaSource' in window && MediaSource.isTypeSupported(this.mimeCodec)) {
      this.mediaSource = new MediaSource();
      this.video.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', () => this.sourceOpen());
    } else {
      logger.error('Unsupported MIME type or codec: ', this.mimeCodec);
    }
  }
  actionPlay() {
    const onPlay = () => {
      document.querySelector('body').removeEventListener('click', onPlay);
      logger.info('going play');
      this.video.play().catch(e => logger.error(e.message));
    };
    const canPlay = () => {
      this.video.removeEventListener('canplay', canPlay);
      logger.json({
        fileLength: this.fileLength,
        videoDuration: this.video.duration,
        segmentDuration: this.segmentDuration,
      });
      this.video.addEventListener('timeupdate', () => this.checkBuffer());
      this.video.addEventListener('seeking', event => this.seek(event));
      document.querySelector('body').addEventListener('click', onPlay);
      // document.querySelector('body').click();
    };
    this.video.addEventListener('canplay', canPlay);
  }
  sourceOpen() {
    if (this.mediaSource.sourceBuffers.length) {
      logger.info('sourceOpen duplicate.');
      return;
    }
    this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeCodec);
    this.getFileLength({
      url: this.baseURL,
      headers: this.headers,
    }, fileLength => {
      logger.log((fileLength / 1024 / 1024).toFixed(2), 'MB');
      this.fileLength = fileLength;
      this.actionPlay();
      this.getInfo();
    });
  }
  getInfo() {
    this.fetchRange({
      url: this.baseURL,
      headers: this.headers,
    }, this.infoRange, chank => {
      this.appendSegment(chank);
      this.checkBuffer();
    });
  }
  getFileLength(params, cb) {
    const options = {
      method: 'HEAD',
      headers: params.headers,
    };
    fetch(params.url, options)
    .then(res => res.headers.get('content-length'))
    .then(length => cb(length));
  }
  fetchRange(params, range, cb) {
    const options = {
      method: 'GET',
      headers: params.headers,
    };
    options.headers.Range = `bytes=${range}`,
    fetch(params.url, options)
    .then(res => res.arrayBuffer())
    .then(chunk => cb(chunk));
  }
  fetchSegment(segment, params) {
    if (this.interrupt || segment > params.last) return params.finish();
    const next = () => {
      this.fetchSegment(segment + 1, params);
    };
    if (this.segments[segment].loaded) return next();
    console.json('time to fetch next chunk', {
      current: `${segment + 1} / ${this.segments.length}`,
      range: this.segments[segment].range,
    });
    this.segments[segment].loaded = true;
    this.fetchRange({
      url: this.baseURL,
      headers: this.headers,
    }, this.segments[segment].range, chank => {
      this.appendSegment(chank, segment);
      next();
    });
  }
  checkBuffer() {
    const currentSegment = this.getCurrentSegment();
    logger.log(`${currentSegment} - ${this.video.currentTime}`);
    const ahead = () => {
      this.inWork = true;
      const finish = () => {
        delete this.inWork;
        delete this.interrupt;
        if (this.segments.length - 1 === currentSegment) this.lastSegment();
      };
      const last = Math.min(currentSegment + 8, this.segments.length - 1);
      this.fetchSegment(currentSegment, { last, finish });
    };
    if (this.inWork) return;
    if (this.interrupt) {
      setTimeout(() => {
        this.interrupt = false;
        this.checkBuffer();
      }, 8000);
    }
    ahead();
  }
  appendSegment(chunk, segment) {
    if (chunk) this.queue.push({ chunk, segment });
    if (this.sourceBuffer.updating) return setTimeout(() => this.appendSegment(), 20);
    const queue = this.queue.shift();
    logger.log(`append: ${queue.segment + 1}`);
    this.sourceBuffer.appendBuffer(queue.chunk);
  }
  lastSegment() {
    logger.log('last segment', this.mediaSource.readyState);
    if (this.sourceBuffer.updating) return setTimeout(() => this.lastSegment(), 1000);
    if (this.mediaSource.readyState === 'ended') return;
    this.mediaSource.endOfStream();
    this.clearCache();
    this.segments[this.segments.length - 1].loaded = true;
  }
  clearCache() {
    this.segments.forEach(segment => segment.loaded = false);
  }
  seek(event) {
    logger.json({
      readyState: this.mediaSource.readyState,
      event,
    });
    this.interrupt = true;
    const afterCheck = () => {
      if (this.inWork) return setTimeout(() => afterCheck(), 200);
      this.clearCache();
      this.checkBuffer();
    };
    setTimeout(() => afterCheck(), 200);
    if (this.mediaSource.readyState !== 'open') {
      logger.log('seek but not open?');
    }
  }
  getCurrentSegment() {
    let current = (this.video.currentTime * 1000) - (this.segmentDuration * 0.5);
    if (current < 0) current = 0;
    return Math.floor(current / this.segmentDuration);
  }
}
