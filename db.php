<?php

$conn = mysqli_connect("localhost", "root", "", "academic_resources");

if(!$conn){
    die("Connection Failed: " . mysqli_connect_error());
}

?>