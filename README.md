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
