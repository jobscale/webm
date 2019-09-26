FROM httpd
SHELL ["bash", "-c"]
RUN apt update && apt install -y openssl
COPY . .
ENV realm realm
ENV user joi
ENV password false
RUN digest="$(printf "%s:%s:%s" "$user" "$realm" "$password" | md5sum | awk '{print $1}')" \
 && printf "%s:%s:%s\n" "$user" "$realm" "$digest" | tee -a "passwd.digest" \
 && echo $user:$(openssl passwd -apr1 $password) | tee passwd.basic
RUN rm -fr htdocs && ln -sfn public htdocs \
 && . ssl-keygen \
 && cp httpd.conf conf/httpd.conf
EXPOSE 443 80
