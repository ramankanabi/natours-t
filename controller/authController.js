const jwt = require("jsonwebtoken");
const User = require("../model/usersModel");
const crypto = require("crypto");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { promisify } = require("util");
const sendEmail = require("./../utils/email");
const bcrypt = require("bcryptjs");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode,req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    // if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  };

  res.cookie("jwt", token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};
exports.signUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirmed: req.body.passwordConfirmed,
    role: req.body.role,
  });

  createSendToken(newUser, 201,req, res);
});

exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return next(AppError("check the email and password"), 404);
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("check the email and password", 401));
  }
  createSendToken(user, 200, req,res);
};

exports.protect = catchAsync(async (req, res, next) => {
  //getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("you are not loged ! please login to get access.")
    );
  }

  const decode = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decode.id);

  if (!currentUser) {
    return next(
      new AppError("the user belonging to this token does no longer exist")
    );
  }

  if (currentUser.passwordChangedAfter(decode.iat)) {
    return next(
      new AppError("User recently changed password ! please login again.", 401)
    );
  }
  req.user = currentUser;
  next();
});

exports.restrictTo = (...role) => {
  return (req, res, next) => {
    if (!role.includes(req.user.role)) {
      return next(
        new AppError("you have not permission to do this acion", 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1 get user based on posman email
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(
      new AppError("there are no user with this email address!", 404)
    );
  }
  //2 generate random reset token
  const resetToken = await user.createPasswordResetToken();
  // await user.save();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;
  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 10 min)",
      message,
    });
    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  console.log(hashedToken);
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("the token is invalid or expires"), 404);
  }
  user.password = req.body.password;
  user.passwordConfirmed = req.body.passwordConfirmed;
  user.passwordChangedAt = Date.now();
  (user.passwordResetExpire = undefined),
    (user.passwordResetToken = undefined),
    await user.save();

    createSendToken(user, 201,req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("the old password is incorrect", 401));
  }
  user.password = req.body.password;
  user.passwordConfirmed = req.body.passwordConfirmed;
  user.passwordChangedAt = Date.now();
  await user.save();

  createSendToken(user, 200,req, res);
});
