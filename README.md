# Gestão & Gargalos de Implantação

Dashboard interativo para acompanhamento de demandas de implantação de software, monitoramento de estagnação semanal e diagnóstico de gargalos por etapa operacional.

---

## 💻 Como Rodar Localmente no seu Computador

### 1. Pré-requisitos
* **Node.js**: Versão 20 ou 22 LTS instalada ([Download Node.js](https://nodejs.org/)).
* **Git** (opcional, para clonar o repositório).

### 2. Passo a Passo

```bash
# 1. Clone o repositório ou baixe o arquivo ZIP do GitHub
git clone https://github.com/sabaistorefrc-svg/softup.git

# 2. Acesse a pasta do projeto
cd softup

# 3. Instale as dependências
npm install

# 4. Inicie o servidor local de desenvolvimento
npm run dev
```

Pronto! O terminal exibirá o endereço local, geralmente:
👉 **`http://localhost:3000`**

Basta abrir esse endereço no seu navegador (Google Chrome, Edge, etc.) para visualizar e interagir com o dashboard.

---

### 3. Outros Comandos Úteis

* **Testar o build de produção localmente**:
  ```bash
  npm run build
  npm run preview
  ```
* **Checagem de tipos (TypeScript)**:
  ```bash
  npm run lint
  ```

---

## 🚀 Como publicar na Vercel

O projeto já está 100% configurado com `vercel.json` e otimizado para o framework **Vite + React**.

### Opção 1: Via GitHub / GitLab / Bitbucket (Recomendado)
1. Suba este repositório para o seu GitHub (ou GitLab).
2. Acesse [vercel.com](https://vercel.com) e clique em **Add New... > Project**.
3. Importe o repositório.
4. A Vercel detectará automaticamente as configurações:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --legacy-peer-deps` (já configurado no `vercel.json` e `.npmrc`)
5. Clique em **Deploy**.

---

### Opção 2: Via Vercel CLI no terminal
Caso utilize o terminal:
```bash
# 1. Instale a CLI da Vercel (se ainda não tiver)
npm i -g vercel

# 2. Na pasta do projeto, execute:
vercel

# 3. Para publicar diretamente em produção:
vercel --prod
```

---

## 🛠️ Tecnologias Utilizadas
- **React 19**
- **Vite 8**
- **Tailwind CSS v4**
- **Lucide React** (Ícones)
- **TypeScript**
