FROM httpd
SHELL ["bash", "-c"]
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && apt-get clean && rm -fr /var/lib/apt/lists/*
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
