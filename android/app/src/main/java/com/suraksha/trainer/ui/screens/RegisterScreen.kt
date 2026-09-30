package com.suraksha.trainer.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.NavController
import com.suraksha.trainer.R
import com.suraksha.trainer.core.AppContainer
import com.suraksha.trainer.ui.navigation.Routes
import kotlinx.coroutines.launch

class RegisterViewModel(private val container: AppContainer) : ViewModel() {
    suspend fun register(name: String, phone: String, site: String, district: String, language: String) =
        container.workerRepository.register(name, phone, site, district, language)
}

fun registerViewModelFactory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
    initializer { RegisterViewModel(container) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(container: AppContainer, nav: NavController) {
    val vm: RegisterViewModel = viewModel(factory = registerViewModelFactory(container))
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var site by remember { mutableStateOf("") }
    var district by remember { mutableStateOf("") }
    var language by remember { mutableStateOf("hi") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reg_title)) },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "back")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp)
        ) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.reg_name)) },
                placeholder = { Text(stringResource(R.string.reg_name_hint)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it.filter { c -> c.isDigit() }.take(10) },
                label = { Text(stringResource(R.string.reg_phone)) },
                placeholder = { Text(stringResource(R.string.reg_phone_hint)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = site,
                onValueChange = { site = it },
                label = { Text(stringResource(R.string.reg_site)) },
                placeholder = { Text(stringResource(R.string.reg_site_hint)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = district,
                onValueChange = { district = it },
                label = { Text(stringResource(R.string.reg_district)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            var expanded by remember { mutableStateOf(false) }
            val languages = listOf("hi" to "हिन्दी (Hindi)", "sat" to "Santali (Ol Chiki)", "en" to "English")
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(languages.firstOrNull { it.first == language }?.second ?: "हिन्दी")
            }
            // lightweight language dropdown alternative (keep simple)
            if (expanded) {
                languages.forEach { (code, label) ->
                    OutlinedButton(onClick = { language = code; expanded = false }, modifier = Modifier.fillMaxWidth()) {
                        Text(label)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = {
                    if (name.isBlank() || phone.length < 10 || site.isBlank()) {
                        Toast.makeText(context, R.string.reg_invalid, Toast.LENGTH_SHORT).show()
                    } else {
                        scope.launch {
                            vm.register(name, phone.trim(), site.trim(), district.trim().ifBlank { "Dhanbad" }, language)
                            Toast.makeText(context, R.string.reg_created_offline, Toast.LENGTH_LONG).show()
                            nav.navigate(Routes.HOME) {
                                popUpTo(Routes.ONBOARDING) { inclusive = true }
                            }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.reg_submit))
            }
        }
    }
}