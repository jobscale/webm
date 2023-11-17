#### run with container

```bash
git clone https://github.com/jobscale/webm.git
cd webm
main() {
  docker build . -t local/webm:0.0.1
  docker run --rm -d --name webm -p 443:443 -p 80:80 local/webm:0.0.1
  https_proxy= curl -vk https://127.0.0.1
  http_proxy= curl -v http://127.0.0.1
} && main
```

### Generate Video

```
docker pull jobscale/mp4box
cat README.md

ffmpeg -i ${INPUT} -c:v h264 -c:a aac -frag_duration 5 -movflags empty_moov+default_base_moof+frag_keyframe+faststart ${OUTPUT}
MP4Box -dash 5000 ${OUTPUT}
```
