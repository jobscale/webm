const env = {
  logging: false,
};
const logger = {};
Object.keys(console).forEach(key => logger[key] = console[key]);
const native = () => {};
console.log = native;
console.info = native;
console.warn = native;
console.error = native;
logger.json = (...argv) => {
  if (argv.length === 1) return logger.info(JSON.stringify(argv[0], null, 2));
  logger.info(JSON.stringify({ argv }, null, 2));
};
if (!env.logging) {
  logger.log = native;
  logger.info = native;
  logger.warn = native;
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
    .catch(e => {
      logger.error(e.message);
    });
  }
  parseMPD(mpd) {
    this.infoRange = /<Initialization range.+(\d+-\d+)/.exec(mpd)[1];
    const basePath = this.assetURL.indexOf('/') !== -1 ? /(.*\/)/.exec(this.assetURL)[1] : '';
    const baseName = /<BaseURL>(.+)<\/BaseURL>/.exec(mpd)[1];
    this.baseURL = `${basePath}${baseName}`;
    this.segmentDuration = /<SegmentList.+duration="(\d+)"/.exec(mpd)[1];
    this.segments = mpd.match(/mediaRange="\d+-\d+"/g)
    .map(v => ({ range: /.+"(\d+-\d+)"/.exec(v)[1] }));
    this.mimeType = /<Representation.+mimeType="([\w/]+)"/.exec(mpd)[1];
    this.codecs = /<Representation.+(codecs="[\w\d\.,-]+")/.exec(mpd)[1];
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
    const isTypeSupported = 'MediaSource' in window && MediaSource.isTypeSupported(this.mimeCodec);
    if (!isTypeSupported) {
      logger.error('Unsupported MIME type or codec: ', this.mimeCodec);
      return;
    }
    this.mediaSource = new MediaSource();
    this.mediaSource.addEventListener('sourceopen', () => this.sourceOpen());
    this.video.src = URL.createObjectURL(this.mediaSource);
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
      const events = [
        ['loadstart', '読み込み開始'],
        ['progress ', '読み込み中'],
        ['suspend', '中断'],
        ['load ', '読み込み'],
        ['abort', '中断'],
        ['error', 'エラー'],
        ['emptied', '初期化'],
        ['stalled', '失速'],
        ['play ', '再生開始'],
        ['pause', '再生停止'],
        ['loadedmetadata ', 'メタデータの読み込み完了'],
        ['loadeddata ', 'データの読み込み完了'],
        ['waiting', '待機中'],
        ['playing', '再生中'],
        ['canplaythrough ', '現在の読み込み速度から途切れずに再生可能なタイミング'],
        ['seeked ', '捜査完了'],
        ['ended', '終わり'],
        ['ratechange ', '再生速度変更'],
        ['durationchange ', 'duration属性変更'],
        ['volumechange ', '音量変更'],
      ];
      events.forEach(eve => {
        this.video.addEventListener(eve[0], () => logger.log(eve[1]));
      });
      document.querySelector('body').addEventListener('click', onPlay);
      document.querySelector('body').click();
    };
    this.video.addEventListener('canplay', canPlay);
  }
  sourceOpen() {
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
    })
    .then(() => {
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
    .then(length => cb(length))
    .catch(e => {
      logger.error(e.message);
    });
  }
  fetchRange(params, range, cb) {
    const options = {
      method: 'GET',
      headers: params.headers,
    };
    options.headers.Range = `bytes=${range}`;
    return fetch(params.url, options)
    .then(res => res.arrayBuffer())
    .then(chunk => {
      cb(chunk);
    })
    .catch(e => {
      logger.error(e.message);
      throw e;
    });
  }
  fetchSegment(segment, params) {
    if (this.interrupt || segment > params.last) return params.finish();
    const next = () => {
      this.fetchSegment(segment + 1, params);
    };
    if (this.segments[segment].loaded) return next();
    logger.json('time to fetch next chunk', {
      current: `${segment} / ${this.segments.length - 1}`,
      range: this.segments[segment].range,
    });
    this.fetchRange({
      url: this.baseURL,
      headers: this.headers,
    }, this.segments[segment].range, chank => {
      this.appendSegment(chank, segment);
      this.segments[segment].loaded = true;
    })
    .then(() => {
      next();
    })
    .catch(e => {
      logger.log(e.message);
      params.finish();
      setTimeout(() => this.checkBuffer('retry on error.'), this.segmentDuration);
    });
  }
  checkBuffer() {
    const currentSegment = this.getCurrentSegment();
    logger.log(`${currentSegment} - ${this.video.currentTime}`);
    this.generateSegment(currentSegment);
  }
  generateSegment(currentSegment) {
    if (this.inWork) return;
    if (this.interrupt) {
      delete this.interrupt;
      if (currentSegment > 0) currentSegment--;
    }
    this.inWork = true;
    const finish = () => {
      delete this.inWork;
      const isLast = this.video.duration - this.video.currentTime < 1;
      if (isLast) this.lastSegment();
    };
    const last = Math.min(currentSegment + 6, this.segments.length - 1);
    this.fetchSegment(currentSegment, { last, finish });
  }
  appendSegment(chunk, segment) {
    if (chunk) this.queue.push({ chunk, segment });
    if (this.sourceBuffer.updating) return setTimeout(() => this.appendSegment(), 20);
    const queue = this.queue.shift();
    logger.log(`append: ${queue.segment}`);
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
      'mediaSource.readyState': this.mediaSource.readyState,
      'video.readyState': [
        'HAVE_NOTHING',
        'HAVE_METADATA',
        'HAVE_CURRENT_DATA',
        'HAVE_FUTURE_DATA',
        'HAVE_ENOUGH_DATA'
      ][this.video.readyState],
      event,
    });
    this.interrupt = true;
    this.nowSeeking();
  }
  nowSeeking() {
    clearTimeout(this.idTimerAfterSeek);
    this.idTimerAfterSeek = setTimeout(() => this.afterSeek(), 1 * 1000);
  }
  afterSeek() {
    if (this.inWork) return this.nowSeeking();
    if (this.mediaSource.readyState !== 'open') {
      logger.log('seek but not open?');
    }
    this.clearCache();
    this.checkBuffer();
  }
  getCurrentSegment() {
    return Math.floor(this.video.currentTime * 1000 / this.segmentDuration);
  }
}
