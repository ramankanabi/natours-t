const express = require("express");
const userController = require("../controller/usersController");
const authController = require("../controller/authController");

const router = express.Router();

router.post("/signup", authController.signUp);
router.post("/login", authController.login);
router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

router.use(authController.protect);

router.patch("/updatePassword", authController.updatePassword);

router.get(
  "/me",
  authController.protect,
  userController.getMe,
  userController.getUser
);
router.patch(
  "/updateMe",
  userController.uploadUserPhoto,
  userController.resizingPhoto,
  userController.updateMe
);
router.delete("/deleteMe", userController.deleteMe);

router.use(authController.restrictTo("admin"));
router
  .route("/")
  .get(userController.getAllUser)
  .post(userController.createUser);
router
  .route("/:id")
  .get(userController.getUser)
  .delete(userController.deleteUser)
  .patch(userController.updateUser);
module.exports = router;
