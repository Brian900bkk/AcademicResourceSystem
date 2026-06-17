<?php
include 'db.php';

if(isset($_POST['register'])){

    $fullname = $_POST['fullname'];
    $email = $_POST['email'];
    $password = password_hash($_POST['password'], PASSWORD_DEFAULT);

    $sql = "INSERT INTO users(fullname,email,password)
            VALUES('$fullname','$email','$password')";

    mysqli_query($conn, $sql);

    header("Location: login.php");
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Register</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<h2>Register</h2>

<form method="POST">

    <input type="text" name="fullname" placeholder="Full Name" required><br>

    <input type="email" name="email" placeholder="Email" required><br>

    <input type="password" name="password" placeholder="Password" required><br>

    <button type="submit" name="register">Register</button>

</form>

</body>
</html>