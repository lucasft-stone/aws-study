#!/bin/bash

# Script para configurar um ambiente de desenvolvimento no Ubuntu.
# Instala:
# - Docker & Docker Compose
# - AWS CLI
# - NVM (Node Version Manager) e a versão LTS mais recente do Node.js

# Garante que o script pare a execução se algum comando falhar.
set -e

echo "--- Iniciando a configuração do ambiente ---"

# --- ATUALIZAR PACOTES E INSTALAR PRÉ-REQUISITOS ---
echo "-> Atualizando a lista de pacotes..."
sudo apt-get update

echo "-> Instalando pacotes de pré-requisitos..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    unzip

# --- INSTALAR DOCKER E DOCKER COMPOSE ---
echo "-> Removendo quaisquer versões antigas ou conflitantes do Docker..."
# Remove pacotes antigos do Docker/Moby para evitar conflitos.
# Usamos `|| true` para que o script não pare se os pacotes não estiverem instalados.
sudo apt-get remove -y docker docker-engine docker.io containerd runc moby-engine moby-cli moby-containerd moby-runc moby-buildx moby-compose moby-tini || true
sudo apt-get autoremove -y --purge || true


echo "-> Configurando e instalando o Docker..."

# Adicionar a chave GPG oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Configurar o repositório do Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar o Docker Engine, CLI, Containerd e plugins (incluindo o Compose)
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Adicionar o usuário atual ao grupo 'docker' para executar comandos sem 'sudo'
sudo usermod -aG docker $USER
echo "-> Docker instalado. Você precisará fazer logout e login novamente para usar o Docker sem 'sudo'."

# --- INSTALAR AWS CLI ---
echo "-> Instalando o AWS CLI v2..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Limpeza dos arquivos de instalação
rm -rf aws awscliv2.zip
echo "-> AWS CLI instalado com sucesso."
aws --version

# --- INSTALAR NVM E NODE.JS ---
echo "-> Instalando NVM (Node Version Manager)..."
# Baixa e executa o script de instalação do NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Para usar o NVM imediatamente, precisamos carregar o script no shell atual.
# As linhas abaixo também são adicionadas ao seu ~/.bashrc pelo script de instalação.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "-> NVM instalado. Instalando a versão LTS mais recente do Node.js..."
nvm install --lts
nvm use --lts
nvm alias default 'lts/*' # Define a versão LTS como padrão para novos shells

echo "-> Node.js e NPM instalados com sucesso."
node -v
npm -v

echo "--- Configuração concluída com sucesso! ---"
echo "Lembre-se: para usar o Docker sem 'sudo', você precisa fazer logout e login novamente ou iniciar uma nova sessão de shell."
echo "O NVM foi configurado para o seu shell atual e para os próximos que você abrir."