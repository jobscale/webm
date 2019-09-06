#### run with container

```bash
main() {
  git clone https://github.com/jobscale/nginx.git
  cd nginx
  echo "Hello World Boss" > index.html
  docker build . -t local/nginx:0.0.1
  docker run --name nginx --rm -d -v $(pwd):/var/www/html -p 80:80 local/nginx:0.0.1
  http_proxy= curl -v 127.0.0.1
} && main
```
