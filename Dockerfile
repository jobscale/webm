FROM ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /var/site

COPY . .

RUN ./setup

EXPOSE 80

STOPSIGNAL SIGTERM

CMD ["nginx", "-g", "daemon off;"]
