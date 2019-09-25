const logger = console;
class Player {
  constructor(video) {
    this.video = video || document.querySelector('video');
  }
  play(assetURL, mimeCodec, headers) {
    // const mimeCodec = 'video/webm; codecs="vp8,vorbis"';
    this.assetURL = assetURL || 'frag_bunny.mp4';
    this.mimeCodec = mimeCodec || 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    if ('MediaSource' in window && MediaSource.isTypeSupported(this.mimeCodec)) {
      this.mediaSource = new MediaSource;
      // logger.log(mediaSource.readyState); // closed
      this.video.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', () => this.sourceOpen(headers));
    } else {
      logger.error('Unsupported MIME type or codec: ', this.mimeCodec);
    }
  }
  sourceOpen(headers) {
    // logger.log(this.readyState); // open
    const sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeCodec);
    this.fetchAB({
      url: this.assetURL,
      headers,
    }, buf => {
      sourceBuffer.addEventListener('updateend', () => {
        this.mediaSource.endOfStream();
        this.video.play().catch(logger.error);
        // logger.log(mediaSource.readyState); // ended
      });
      sourceBuffer.appendBuffer(buf);
    });
  }
  fetchAB (options, cb) {
    logger.log(options);
    const xhr = new XMLHttpRequest;
    xhr.open('get', options.url);
    Object.keys(options.headers).forEach(key => {
      xhr.setRequestHeader(key, options.headers[key]);
    });
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      cb(xhr.response);
    };
    xhr.send();
  }
}
