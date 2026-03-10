# TalentCurate Kubernetes Deployment (Kustomize)

This directory contains Kubernetes manifests organized using **Kustomize**. This allows for a clean separation between base configurations and environment-specific overlays (e.g., dev, prod).

## Structure
- `base/`: Standard resource definitions and `kustomization.yaml`.
- `overlays/dev/`: Environment-specific patches and settings for Development.
- `overlays/prod/`: Environment-specific patches and settings for Production.

## Prerequisites
1.  A running Kubernetes cluster.
2.  `kubectl` and `kustomize` installed on your machine.

## Deployment Steps

### 1. Configure Secrets (Base)
Open `base/02-secret.yaml` and add your **GEMINI_API_KEY**. In a real production scenario, you would use a Kustomize Secret Generator or a dedicated Secret Manager (like HashiCorp Vault).

### 2. Deploy to Development
To apply the development overlay, run:
```bash
kubectl apply -k overlays/dev
```
Or, if you want to see the generated YAML first:
```bash
kustomize build overlays/dev | less
```

### 3. Deploy to Production
To apply the production overlay, run:
```bash
kubectl apply -k overlays/prod
```

## Key Benefits of this Structure
- **No Duplication**: The core resource definitions live only in `base/`.
- **Environment Isolation**: `dev` and `prod` use different namespaces (`talentcurate-dev` and `talentcurate-prod`) and prefixes (`dev-`, `prod-`).
- **Standardized Labels**: All resources in an overlay automatically get common labels (e.g., `variant: development`).

## Important Notes
- **Images**: The deployment manifests currently use local image names. You should tag and push these images to a container registry and update the `image:` fields, or use the `images:` generator in your overlays.
- **Example Image Override (in kustomization.yaml)**:
  ```yaml
  images:
  - name: frontend
    newName: myregistry.com/talentcurate/frontend
    newTag: v1.0.0
  ```

## ArgoCD Alignment (GitOps)
This repository is pre-configured for **ArgoCD**. You can find the Application manifests in the `argocd/` directory.

### To sync with ArgoCD:
1. Ensure ArgoCD is installed in your cluster.
2. Apply the Application manifest:
   ```bash
   kubectl apply -f argocd/talentcurate-dev.yaml
   ```
3. ArgoCD will automatically track the `main` branch and synchronize the `k8s/overlays/dev` path to your cluster.

## CI/CD Pipeline (GHCR Automation)
The repository is equipped with a GitHub Actions workflow (`.github/workflows/ci.yml`) that:
1.  Triggers on every **push** or **PR** to the `main` branch.
2.  Builds Docker images for **Frontend**, **API**, and **Worker**.
3.  Automatically pushes them to the **GitHub Container Registry (GHCR)**.
4.  Tags images with the short Git SHA and replicates the `latest` tag for the newest stable main build.

To use these images in your deployment, ensure your K8s cluster has permissions to pull from GHCR.
