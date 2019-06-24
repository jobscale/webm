#### install microk8s

```bash
sudo snap install microk8s --channel 1.14/stable --classic
sudo snap alias microk8s.kubectl kubectl
sudo microk8s.start
sudo microk8s.enable dns dashboard
$(which xdg-open || echo open) http://127.0.0.1:8080/api/v1/namespaces/kube-system/services/https:kubernetes-dashboard:/proxy
```

#### Example

```bash
npm run build
npm run save
npm run import
sudo kubectl run nginx --image local/nginx:bionic --replicas=2
sudo kubectl describe deployments.apps nginx
sudo kubectl expose deployment nginx --port 80 --type LoadBalancer --name nginx
```

#### Kubernetes

```bash
sudo kubectl config view --raw
KUBE_NAMESPACE=default
KUBE_SERVICE=nginx
KUBE_TOKEN=$(sudo kubectl describe secrets | grep ^token | awk '{print $2}')
KUBE_HOST=127.0.0.1:16443
open https://${KUBE_HOST}/api/v1/namespaces/kube-system/services/https:kubernetes-dashboard:/proxy
vi ../loadbalancer.json
https_proxy= curl -k --header "Authorization: Bearer $KUBE_TOKEN" https://${KUBE_HOST}/api/v1/namespaces/${KUBE_NAMESPACE}/services/${KUBE_SERVICE}/status -X PUT -d @../loadbalancer.json -H 'content-type:application/json'
```
