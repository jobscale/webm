class Player {
  initVideo() {
    const ms = new MediaSource();
    const video = document.querySelector('video');
    ms.addEventListener('sourceopen', () => this.generateBuffer(ms), false);
    if ('srcObject' in video)
      video.srcObject = ms;
    else
      video.src = URL.createObjectURL(ms);
  }
  load(inFile) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', inFile);
    xhr.responseType = 'arraybuffer';
    xhr.onload = evt => {
      this.webm = evt.target.response;
      this.initVideo();
    };
    xhr.send(null);
  }
  play(inFile) {
    // Element名のうち必要となりそうなものだけを定義
    // (今回はVoid以外は長さが同じとなる範囲でしかチェックしない)
    this.tagEBML = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    this.tagSegment = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
    this.tagCluster = new Uint8Array([0x1f, 0x43, 0xb6, 0x75]);
    this.tagVoid = new Uint8Array([0xec]);
    this.ptr = 0;
    this.load(inFile);
  }
  generateBuffer(ms) {
    // 動画だけで音声を含まない場合はcodecs="vp8"でよい
    this.sb = ms.addSourceBuffer('video/webm; codecs="vp8,vorbis"');
    this.sb.addEventListener('updateend', () => this.appendMediaSegment(), false);
    this.appendInitSegment();
  }
  // 配列(ArrayBufferView)が合致しているかどうかを比較
  equal(a, b) {
    if (a.byteLength !== b.byteLength)
      return false;
    for(let i = 0 ; i < a.byteLength ; i++) {
      if (a[i] !== b[i])
        return false;
    }
    return true;
  }
  // WebMフォーマットのElementサイズを計算
  getElementSize(d, p) {
    let l = 0;
    const n = d[p];
    let j;
    let t = 0;
    for(let i = 0 ; i < 8 ; i++) {
      if ((n >> (7 - i)) > 0) {
        j = i;
        break;
      }
    }
    for (let i = 0 ; i <= j ; i++) {
      let b = d[p + t];
      if (i === 0)
        b -= (1 << 7-j);
      l = l * 256 + b;
      t++;
    }
    return { length: l, offset: t };
  }
  // WebMファイルの先頭から初期化セグメントを取り出してSourceBufferに渡す
  appendInitSegment() {
    let r;
    if (!this.equal(this.tagEBML, this.webm.subarray(this.ptr, this.ptr + this.tagEBML.byteLength))) {
      alert('WebM data error');
      return;
    }
    this.ptr += this.tagEBML.byteLength;
    r = this.getElementSize(this.webm, this.ptr);
    this.ptr += r.offset + r.length;
    if(!this.equal(this.tagSegment, this.webm.subarray(this.ptr, this.ptr + this.tagSegment.byteLength))) {
      alert('WebM data error');
      return;
    }
    this.ptr += this.tagSegment.byteLength;
    r = this.getElementSize(this.webm, this.ptr);
    this.ptr += r.offset;

    // Cluster手前までを検索
    while(!this.equal(this.tagCluster, this.webm.subarray(this.ptr, this.ptr + this.tagCluster.byteLength))) {
      if(this.equal(this.tagVoid, this.webm.subarray(this.ptr, this.ptr + this.tagVoid.byteLength)))
        this.ptr += this.tagVoid.byteLength;
      else
        this.ptr += this.tagCluster.byteLength;
      r = this.getElementSize(this.webm, this.ptr);
      this.ptr += r.offset + r.length;
    }
    // 初期化セグメント = WebMファイルの先頭から最初のClusterの直前まで
    const initSeg = new Uint8Array(this.webm.subarray(0, this.ptr));
    this.sb.appendBuffer(initSeg.buffer);
  }
  // Clusterを取り出してメディアセグメントとしてSourceBufferに渡す
  appendMediaSegment() {
    const start = this.ptr;

    // Clusterを最後まで読み終われば終了
    if(!this.equal(this.tagCluster, this.webm.subarray(this.ptr, this.ptr + this.tagCluster.byteLength)))
      return;

    this.ptr += this.tagCluster.byteLength;
    const r = this.getElementSize(this.webm, this.ptr);
    this.ptr += r.offset + r.length;
    const mediaSeg = new Uint8Array(this.webm.subarray(start, this.ptr));
    this.sb.appendBuffer(mediaSeg.buffer);
  }
}
