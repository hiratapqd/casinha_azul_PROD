import os
from random import randint, choice
import sys
import urllib.parse as up
import json
from dotenv import load_dotenv
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo import ReturnDocument


load_dotenv()
uri = os.getenv("MONGODB_URI")

def get_mongo_client():
    return MongoClient(uri, server_api=ServerApi('1'))

def get_database(database_name="casinha_azul"):
    client = get_mongo_client()
    return client[database_name]

def get_collection(collection_name,database_name="casinha_azul"):
    db = get_database(database_name)
    return db[collection_name]


def list_collections(database_name=None):
    client = get_mongo_client()
    if database_name:
        return client[database_name].list_collection_names()

    databases = client.list_database_names()
    collections_by_database = {}

    for db_name in databases:
        collections_by_database[db_name] = client[db_name].list_collection_names()

    return collections_by_database

def get_all_documents():
    collection = get_collection("terapias")
    
    # .find({}) sem filtros retorna todos os documentos
    documents = list(collection.find({}))
    
    return documents

if __name__ == '__main__':
    #print(list_collections(database_name=None))
    print(get_all_documents())