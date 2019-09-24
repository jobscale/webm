FROM nginx
SHELL ["bash", "-c"]
WORKDIR /usr/share/nginx
RUN apt update && apt install -y openssl
COPY . .
RUN rm -fr html && ln -sfn public html \
 && . ssl-keygen \
 && . ssl-client-keygen \
 && openssl dhparam 2048 > tls/dhparam.pem \
 && cp nginx.conf /etc/nginx/nginx.conf \
 && cp default.conf /etc/nginx/conf.d/default.conf
EXPOSE 443 80
CMD ["nginx", "-g", "daemon off;"]
