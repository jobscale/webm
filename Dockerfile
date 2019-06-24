FROM ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /root

COPY . .
COPY site /var
RUN ./setup

EXPOSE 80
CMD ["./daemon"]
