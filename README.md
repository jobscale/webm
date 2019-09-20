#### run with container

```bash
git clone https://github.com/jobscale/nginx.git
cd nginx
main() {
  docker build . -t local/nginx:0.0.1
  docker run --name nginx --rm -p 443:443 -p 80:80 local/nginx:0.0.1
  https_proxy= curl -vk https://127.0.0.1
  http_proxy= curl -v http://127.0.0.1
} && main
```
