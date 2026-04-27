## Let's Snog (self-sufficient deployment)

This repo was originally scaffolded on Emergent and has been migrated to run independently with:

- **Frontend**: Create React App on **Vercel** (`dating-app/frontend`)
- **Backend**: **FastAPI** container on **AWS ECS Fargate** (`dating-app/backend`)
- **Auth**: **AWS Cognito User Pool** (custom in-app UI; API uses Bearer JWTs)
- **DB**: **MongoDB Atlas**
- **Photos**: **S3** (presigned uploads)
- **LLM (optional)**: **AWS Bedrock** (`ENABLE_SNOG_AI=true`)

### Frontend (Vercel)
- **Root dir**: `frontend/`
- **Build**: `npm run build`
- **Output**: `build/`
- **Env vars**: copy `frontend/.env.example` into Vercel project env vars.

Required env vars:
- `REACT_APP_BACKEND_URL`
- `REACT_APP_COGNITO_REGION`
- `REACT_APP_COGNITO_USER_POOL_ID`
- `REACT_APP_COGNITO_APP_CLIENT_ID`

### Backend (AWS ECS)
- Build the container from `backend/Dockerfile`.
- Configure task env vars (see `backend/.env.example`).

Required env vars:
- `MONGO_URL`, `DB_NAME`, `APP_NAME`
- `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID`
- `S3_BUCKET`, `AWS_REGION` (and ideally `S3_PUBLIC_BASE_URL`)
- `CORS_ORIGINS` (comma-separated list including your Vercel domains)

### Local dev quickstart
1. Create `backend/.env` from `backend/.env.example`
2. Create `frontend/.env.local` from `frontend/.env.example`
3. Run backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

4. Run frontend:

```bash
cd frontend
npm install
npm start
```
