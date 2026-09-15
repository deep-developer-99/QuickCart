import jwt from "jsonwebtoken";

interface JwtPayload {
  id: string;
  role: "user" | "vendor" | "admin";
}

const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });
};

export default generateToken;
