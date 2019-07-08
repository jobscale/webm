FROM jobscale/ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /root

RUN apt install -y nginx nginx-extras

EXPOSE 80 443
CMD ["nginx", "daemon off;"]
