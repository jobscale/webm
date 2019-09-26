const logger = console;

class Player {
  constructor(video) {
    this.video = video || document.querySelector('video');
    this.totalSegments = 5;
    this.segmentLength = 0;
    this.segmentDuration = 0;
    this.bytesFetched = 0;
    this.requestedSegments = [];
  }
  play(assetURL, mimeCodec, headers) {
    // const mimeCodec = 'video/webm; codecs="vp8,vorbis"';
    this.assetURL = assetURL || 'frag_bunny.mp4';
    this.mimeCodec = mimeCodec || 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    this.headers = headers || {};
    for (let i = 0; i < this.totalSegments; ++i) this.requestedSegments[i] = false;
    if ('MediaSource' in window && MediaSource.isTypeSupported(mimeCodec)) {
      this.mediaSource = new MediaSource;
      // logger.log(this.mediaSource.readyState); // closed
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
      this.segmentDuration = this.video.duration / this.totalSegments;
      this.video.play().catch(e => logger.error(e.message));
    };
    this.requestedSegments[0] = true;
    this.video.addEventListener('timeupdate', () => this.checkBuffer());
    this.video.addEventListener('seeking', pos => this.seek(pos));
    this.video.addEventListener('canplay', () => {
      document.querySelector('body').addEventListener('click', onPlay);
      document.querySelector('body').click();
    });
  }
  sourceOpen() {
    this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeCodec);
    this.getFileLength({
      url: this.assetURL,
      headers: this.headers,
    }, fileLength => {
      logger.log((fileLength / 1024 / 1024).toFixed(2), 'MB');
      // totalLength = fileLength;
      this.segmentLength = Math.round(fileLength / this.totalSegments);
      // logger.log(totalLength, this.segmentLength);
      this.fetchRange({
        url: this.assetURL,
        headers: this.headers,
      }, 0, this.segmentLength, chank => this.appendSegment(chank));
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
    const xhr = new XMLHttpRequest;
    xhr.open('get', options.url);
    Object.keys(options.headers || {}).forEach(key => {
      xhr.setRequestHeader(key, options.headers[key]);
    });
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', 'bytes=' + start + '-' + end);
    xhr.onload = () => {
      logger.log('fetched bytes: ', start, end);
      this.bytesFetched += end - start + 1;
      cb(xhr.response);
    };
    xhr.send();
  }
  appendSegment(chunk) {
    this.sourceBuffer.appendBuffer(chunk);
  }
  checkBuffer() {
    if (this.mediaSource.readyState === 'ended') return;
    const currentSegment = this.getCurrentSegment();
    if (currentSegment === this.totalSegments && this.haveAllSegments()) {
      logger.log('last segment', this.mediaSource.readyState);
      this.mediaSource.endOfStream();
      this.video.removeEventListener('timeupdate', () => this.checkBuffer());
    } else if (this.shouldFetchNextSegment(currentSegment)) {
      this.requestedSegments[currentSegment] = true;
      console.log('time to fetch next chunk', this.video.currentTime);
      this.fetchRange({
        url: this.assetURL,
        headers: this.headers,
      }, this.bytesFetched, this.bytesFetched + this.segmentLength, chank => this.appendSegment(chank));
    }
    // logger.log(video.currentTime, currentSegment, this.segmentDuration);
  }
  seek(pos) {
    logger.log({ pos });
    if (this.mediaSource.readyState === 'open') {
      this.sourceBuffer.abort();
      logger.log(this.mediaSource.readyState);
    } else {
      logger.log('seek but not open?');
      logger.log(this.mediaSource.readyState);
    }
  }
  getCurrentSegment() {
    return ((this.video.currentTime / this.segmentDuration) | 0) + 1;
  }
  haveAllSegments() {
    return this.requestedSegments.every(val => {
      return !!val;
    });
  }
  shouldFetchNextSegment(currentSegment) {
    if (currentSegment > this.totalSegments) return false;
    return this.video.currentTime > this.segmentDuration * currentSegment * 0.8 &&
      !this.requestedSegments[currentSegment];
  }
}
