<?php
session_start();
include 'db.php';

if(isset($_POST['login'])){

    $email = $_POST['email'];
    $password = $_POST['password'];

    $sql = "SELECT * FROM users WHERE email='$email'";

    $result = mysqli_query($conn, $sql);

    if(mysqli_num_rows($result) > 0){

        $user = mysqli_fetch_assoc($result);

        if(password_verify($password, $user['password'])){

            $_SESSION['user'] = $user['fullname'];

            header("Location: dashboard.php");

        }else{
            echo "Incorrect Password";
        }

    }else{
        echo "User Not Found";
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Login</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<h2>Login</h2>

<form method="POST">

    <input type="email" name="email" placeholder="Email" required><br>

    <input type="password" name="password" placeholder="Password" required><br>

    <button type="submit" name="login">Login</button>

</form>

</body>
</html>