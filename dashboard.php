<?php
session_start();

if(!isset($_SESSION['user'])){
    header("Location: login.php");
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<h1>Welcome <?php echo $_SESSION['user']; ?></h1>

<h2>Dashboard</h2>

<a href="upload.php">Upload Resource</a>

<a href="logout.php">Logout</a>

</body>
</html>