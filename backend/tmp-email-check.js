const { IsEmail, validate } = require("class-validator");
class D { constructor(email){ this.email = email; } }
require("reflect-metadata");
const { plainToInstance } = require("class-transformer");
const { ForgotPasswordDto } = require("./dist/src/auth/dto/password.dto");
