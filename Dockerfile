FROM nginx
SHELL ["bash", "-c"]
WORKDIR /usr/share/nginx
COPY . .
RUN rm -fr html && ln -sfn public html \
 && . ssl-keygen \
 && openssl dhparam 2048 -out tls/dhparam.pem \
 && cp default.conf /etc/nginx/conf.d/default.conf
EXPOSE 443 80
CMD ["nginx", "-g", "daemon off;"]
