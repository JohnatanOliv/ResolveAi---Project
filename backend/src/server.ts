import dotenv from "dotenv";
import { app } from "./app";

dotenv.config();

const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
