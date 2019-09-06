FROM jobscale/debian:buster
SHELL ["bash", "-c"]

WORKDIR /root

RUN apt-get update && apt-get install -y nginx nginx-extras

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
