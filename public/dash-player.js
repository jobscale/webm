const logger = console;
logger.json = (...argv) => {
  if (argv.length === 1) return logger.info(JSON.stringify(argv[0], null, 2));
  logger.info(JSON.stringify({ argv }, null, 2));
};

class Player {
  constructor(video) {
    this.video = video || document.querySelector('video');
    this.fastLength = 5 * 1024 * 1024;
    this.totalSegments = 0;
    this.segmentLength = 0;
    this.segmentDuration = 5;
    this.bytesFetched = 0;
    this.requestedSegments = [];
  }
  play(assetURL, mimeCodec, headers) {
    this.assetURL = assetURL || 'frag_bunny.mp4';
    this.mimeCodec = mimeCodec || 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    this.headers = headers || {};
    if ('MediaSource' in window && MediaSource.isTypeSupported(mimeCodec)) {
      this.mediaSource = new MediaSource();
      this.video.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', () => this.sourceOpen());
    } else {
      logger.error('Unsupported MIME type or codec: ', mimeCodec);
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
      this.totalSegments = Math.ceil(this.video.duration / this.segmentDuration);
      this.segmentLength = Math.ceil(this.fileLength / this.totalSegments);
      logger.json({
        segmentLength: this.segmentLength,
        fileLength: this.fileLength,
        totalSegments: this.totalSegments,
        videoDuration: this.video.duration,
        segmentDuration: this.segmentDuration,
      });
      this.video.addEventListener('timeupdate', () => this.checkBuffer());
      this.video.addEventListener('seeking', pos => this.seek(pos));
      document.querySelector('body').addEventListener('click', onPlay);
      // document.querySelector('body').click();
    };
    this.video.addEventListener('canplay', canPlay);
  }
  sourceOpen() {
    this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeCodec);
    this.getFileLength({
      url: this.assetURL,
      headers: this.headers,
    }, fileLength => {
      logger.log((fileLength / 1024 / 1024).toFixed(2), 'MB');
      this.fileLength = fileLength;
      this.fetchRange({
        url: this.assetURL,
        headers: this.headers,
      }, 0, this.fastLength - 1, chank => this.appendSegment(chank));
      this.actionPlay();
    });
  }
  getFileLength(options, cb) {
    const xhr = new XMLHttpRequest;
    xhr.open('head', options.url);
    Object.keys(options.headers || {}).forEach(key => {
      xhr.setRequestHeader(key, options.headers[key]);
    });
    xhr.onload = () => {
      cb(xhr.getResponseHeader('content-length'));
    };
    xhr.send();
  }
  fetchRange(options, start, end, cb) {
    console.json('time to fetch next chunk', {
      currentTime: this.video.currentTime,
      start,
      end,
      range: end - start + 1,
    });
    const xhr = new XMLHttpRequest;
    xhr.open('get', options.url);
    Object.keys(options.headers || {}).forEach(key => {
      xhr.setRequestHeader(key, options.headers[key]);
    });
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', 'bytes=' + start + '-' + end);
    xhr.onload = () => {
      cb(xhr.response);
    };
    xhr.send();
  }
  inHead(pos) {
    return pos < this.fastLength;
  }
  fetchSegment(segment, next) {
    const finish = segment === this.totalSegments && this.haveAllSegments() && this.getCurrentSegment() === this.totalSegments - 1;
    if (finish) {
      logger.log('last segment', this.mediaSource.readyState);
      this.mediaSource.endOfStream();
      this.video.removeEventListener('timeupdate', () => this.checkBuffer());
      return Promise.resolve({ status: 'finished.' });
    }
    if (!this.shouldFetchSegment(segment)) return Promise.resolve({ status: 'segment exist.' });
    const promise = {};
    promise.instance = new Promise((...argv) => {
      [ promise.resolve, promise.reject ] = argv;
    });
    this.requestedSegments[segment] = true;
    let start = this.segmentLength * segment;
    let end = this.segmentLength * (segment + 1) - 1;
    if (this.inHead(end)) return Promise.resolve({ status: 'segment exist.' });
    if (this.inHead(start)) start = this.fastLength;
    if (end >= this.fileLength) end = this.fileLength - 1;
    this.fetchRange({
      url: this.assetURL,
      headers: this.headers,
    }, start, end, chank => {
      this.appendSegment(chank);
      promise.resolve({ status: 'ok' });
    });
    return promise.instance;
  }
  checkBuffer() {
    if (this.mediaSource.readyState === 'ended') return;
    const currentSegment = this.getCurrentSegment();
    const ahead = async () => {
      this.inWork = true;
      const last = Math.min(currentSegment + 8, this.totalSegments + 1);
      for (let i = 0; i < last; i++) {
        await this.fetchSegment(i);
      }
      delete this.inWork;
    };
    if (this.inWork) return;
    ahead();
  }
  appendSegment(chunk) {
    this.sourceBuffer.appendBuffer(chunk);
  }
  seek(event) {
    logger.json({
      readyState: this.mediaSource.readyState,
      event,
    });
    if (this.mediaSource.readyState !== 'open') {
      logger.log('seek but not open?');
      return;
    }
  }
  getCurrentSegment() {
    return Math.floor(this.video.currentTime / this.segmentDuration);
  }
  haveAllSegments() {
    return this.requestedSegments.every(val => {
      return !!val;
    });
  }
  shouldFetchSegment(segment) {
    if (segment >= this.totalSegments) return false;
    return !this.requestedSegments[segment];
  }
}
