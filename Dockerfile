FROM ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /root

COPY . .
COPY site /var/site
RUN ./setup

EXPOSE 80
CMD ["./daemon"]
