# ProCurrículo - Guia de Exportação e Implantação Externa

Este projeto foi preparado para ser executado fora do ambiente do Google AI Studio. Siga as instruções abaixo para configurar e implantar seu aplicativo.

## Pré-requisitos

- **Node.js**: Versão 18 ou superior.
- **Firebase**: Você precisará de um projeto no Firebase para o banco de dados e autenticação.
- **Gemini API Key**: Chave da API do Google Gemini para as funcionalidades de IA.

## Configuração do Ambiente

1.  **Instalar Dependências**:
    ```bash
    npm install
    ```

2.  **Variáveis de Ambiente**:
    - Copie o arquivo `.env.example` para um novo arquivo chamado `.env`.
    - Preencha as variáveis no arquivo `.env` com suas próprias credenciais:
        - `GEMINI_API_KEY`: Sua chave da API do Google AI.
        - `VITE_FIREBASE_*`: Suas credenciais do projeto Firebase (encontradas nas configurações do projeto no console do Firebase).

3.  **Configuração do Firebase**:
    - No Console do Firebase, habilite:
        - **Authentication**: Ative o provedor de login do Google.
        - **Firestore Database**: Crie o banco de dados em modo de produção ou teste.
    - Atualize as regras do Firestore usando o arquivo `firestore.rules` incluído neste projeto.

## Desenvolvimento Local

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:3000`.

## Implantação em Produção

1.  **Build do Frontend**:
    ```bash
    npm run build
    ```

2.  **Iniciar o Servidor de Produção**:
    ```bash
    npm start
    ```

## Estrutura do Projeto

- `server.ts`: Servidor Express que serve o aplicativo e gerencia rotas de API.
- `src/`: Código-fonte do frontend (React + Vite).
- `firestore.rules`: Regras de segurança para o seu banco de dados Firebase.
- `.env.example`: Modelo para configuração de variáveis de ambiente.

## Próximos Passos Sugeridos

- **Pagamentos Reais**: Integre o Stripe ou Mercado Pago no `server.ts` para processar pagamentos reais em vez da simulação atual.
- **Domínio Personalizado**: Configure um domínio próprio para seu aplicativo.
- **Hospedagem**: Este projeto pode ser facilmente implantado no Google Cloud Run, Vercel, Heroku ou qualquer serviço que suporte Node.js.
