const fastify = require('fastify')({ logger: true });
const Sequelize = require('sequelize');
const crypto = require('crypto');

const HOST = 'localhost'
const PORT = 3000;

const DB_DIALECT = 'mysql';
const DB_HOST    = 'localhost';
const DB_PORT    = '3306';

const DB_NAME     = 'designer-db';
const DB_LOGIN    = 'rest_user';
const DB_PASSWORD = 'Pass3306';


fastify.register(require("fastify-cors"), {
    origin: "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTION"],
    credentials: true,
    allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept"
});

fastify.register(require('fastify-jwt'), {
    secret: 'foobar',
    cookie: {
        cookieName: 'token',
        signed: false
    }
});

fastify.register(require('fastify-cookie'));

async function jwtVerify(request, reply, done) {
    try {
        await request.jwtVerify();
    } catch (err) {
        reply.send(err);
    }
}


const sequelize = new Sequelize(DB_NAME, DB_LOGIN, DB_PASSWORD, {
    dialect: DB_DIALECT,
    host:    DB_HOST,
    port:    DB_PORT,
    logging: false,
    define: {
        timestamps: false
    }
});


const jwtCookie = {
    maxAge: 7200000,
    httpOnly: true,
};


const User = sequelize.define('user', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    login: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
    },
    passwordHash: {
        type: Sequelize.STRING(255),
        allowNull: false
    },
    role: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    registerDatetime: {
        type: Sequelize.DATE,
        allowNull: false
    }
});

const Project = sequelize.define('project', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: Sequelize.STRING(255),
        allowNull: false
    },
    modifyingDatetime: {
        type: Sequelize.DATE,
        allowNull: false
    },
    content: {
        type: Sequelize.TEXT('long'),
        allowNull: false
    }
});

const Module = sequelize.define('module', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: Sequelize.STRING(255),
        allowNull: false
    },
    type: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    width: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    height: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    depth: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    content: {
        type: Sequelize.TEXT('long'),
        allowNull: false
    }
});

User.hasMany(Project, { onDelete: 'CASCADE', foreignKey: { allowNull: true } });

const isForce = false;
const isSync = false;
if (isSync === true) {
    sequelize.sync({ force: isForce }).then((result) => {
        console.log('Succsessful DB sync');

        if (isForce === true) {
            fillUserTable();
            fillProjectTable();
            fillModuleTable();
        }
    }).catch((err) => console.log(err));
}


function computePasswordHash(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
};

fastify.get("/modules", async function(request, reply) {
    const Op = Sequelize.Op;
    const maxSize = 999999;

    const category   = request.query['category']   === undefined ? 0 : request.query['category'];
    const min_width  = request.query['min_width']  === undefined ? 0 : request.query['min_width'];
    const max_width  = request.query['max_width']  === undefined ? maxSize : request.query['max_width'];
    const min_height = request.query['min_height'] === undefined ? 0 : request.query['min_height'];
    const max_height = request.query['max_height'] === undefined ? maxSize : request.query['max_height'];
    const min_depth  = request.query['min_depth']  === undefined ? 0 : request.query['min_depth'];
    const max_depth  = request.query['max_depth']  === undefined ? maxSize : request.query['max_depth'];

    Module.findAll({ raw: true, where: {
        type: category,
        width: {
            [Op.between]: [min_width, max_width]
        },
        height: {
            [Op.between]: [min_height, max_height]
        },
        depth: {
            [Op.between]: [min_depth, max_depth]
        }

    } }).then(modules => {
        reply.send({
            code: 0,
            modules: modules
        });
        return;
    }).catch(err => console.log(err));

    return;
});




fastify.get('/projects', 
{ preValidation: [jwtVerify] }, 
async (request, reply) => {
    let userId = fastify.jwt.decode(request.cookies.token).id;

    Project.findAll({ where: { userId: userId }, raw: true }).then(projects => {
        reply.send({
            code: 0,
            projects: projects
        });
        return;

    }).catch(err => console.log(err));
    return;
});

fastify.post('/projects', 
{ preValidation: [jwtVerify] }, 
async (request, reply) => {
    let userId = fastify.jwt.decode(request.cookies.token).id;

    let name = request.body['name'];
    let content = request.body['project'];

    let result = await Project.create({
        name: name,
        modifyingDatetime: new Date(),
        content: content,
        userId: userId
    });

    reply
        .code(200)
        .send({ success: true, message: 'Проект успешно добавлен!' });
});

fastify.patch('/projects/:id', 
{ preValidation: [jwtVerify] }, 
async (request, reply) => {
    let projId   = request.params['id'];
    let userId   = fastify.jwt.decode(request.cookies.token).id;
    let projName = request.body['name'];

    let proj = await Project.findByPk(projId);

    if (proj === null) {
        reply.send({ success: false, message: 'Проект не найден!' });
        return;
    }

    if (proj.userId !== userId) {
        reply.send({ success: false, message: 'Пользователь не является владельцем этого проекта!' });
        return;
    }

    let result = await Project.update({ name: projName }, {
        where: {
            id: projId
        }
    });

    reply
        .code(200)
        .send({ success: true, message: 'Проект успешно переименован!' });
});

fastify.delete('/projects/:id', 
{ preValidation: [jwtVerify] }, 
async (request, reply) => {
    let projId = request.params['id'];
    let userId = fastify.jwt.decode(request.cookies.token).id;

    let proj = await Project.findByPk(projId);

    if (proj === null) {
        reply.send({ success: false, message: 'Проект не найден!' });
        return;
    }

    if (proj.userId !== userId) {
        reply.send({ success: false, message: 'Пользователь не является владельцем этого проекта!' });
        return;
    }

    let result = Project.destroy({
        where: {
            id: projId
        }
    });

    reply
        .code(200)
        .send({ success: true, message: 'Проект успешно удалён!' });
});



async function findUserByLogin(login) {
    return await User.findOne({where: { login: login }, raw: true });
}



fastify.post('/signup', async (request, reply) => {
    let login    = request.body['login'];
    let password = request.body['password'];

    if (login === undefined || login === null || password === undefined || password === null) {
        reply.send({ success: false, message: 'Получены неполные данные!' });
        return;
    }

    if (!login.match(/^[A-Za-z0-9_]{3,255}$/gmu)) {
        reply.send({ success: false, message: 'Логин не соответствует правилам!' });
        return;
    }

    let newUser = await User.create({
        login: login,
        passwordHash: computePasswordHash(password),
        role: true,
        isActive: true,
        registerDatetime: new Date()
    });

    if (newUser === null) {
        reply.send({ success: false, message: 'Данный пользователь уже зарегистрирован!' });
        return;
    }


    reply
        .code(200)
        .send({ success: true, message: 'Регистрация прошла успешно!' });
});

fastify.post('/signin', async (request, reply) => {
    let login    = request.body['login'];
    let password = request.body['password'];

    let user = await findUserByLogin(login);
    if (user === null) {
        reply.send({ success: false, message: 'Пользователь не найден!' });
        return;
    }

    let hash = computePasswordHash(password);
    if (user.passwordHash !== hash) {
        reply
            .send({ success: false, message: 'Неверный пароль!' });
        return;
    }

    const token = fastify.jwt.sign({ time: Date.now(), id: user.id });

    reply
        .setCookie('token', token, jwtCookie)
        .code(200)
        .send({ success: true, message: 'Успешный вход в систему!' });
});

fastify.listen(PORT, (err) => {
    console.log(`Server started: ${PORT}`);
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});